"""
Workspace management API — connect Teams and Slack workspaces.

Teams flow:
  POST /api/workspaces/teams          — store Azure credentials + chat IDs
  POST /api/workspaces/{id}/subscribe — register Graph API subscription
  GET  /api/workspaces/{id}/login     — start delegated Teams auth for this workspace
  GET  /api/workspaces/{id}/auth-callback — OAuth callback for delegated token

Slack OAuth flow:
  GET  /api/slack/install             — redirect to Slack's OAuth consent screen
  GET  /api/slack/callback            — exchange code for bot token, store in DB

General:
  GET  /api/workspaces                — list all workspaces (secrets masked)
  GET  /api/workspaces/{id}           — get one workspace
  PATCH /api/workspaces/{id}          — update credentials
  DELETE /api/workspaces/{id}         — delete workspace (not the default)
"""

import logging
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse, HTMLResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings, GRAPH_BASE_URL
from app.auth import get_current_user, require_super_admin
from app.db.database import get_db
from app.db import crud

logger = logging.getLogger(__name__)

router = APIRouter(tags=["workspaces"])


# ──────────────────────────────────────────────
# Pydantic schemas
# ──────────────────────────────────────────────


class TeamsWorkspaceCreate(BaseModel):
    name: str = "Teams Workspace"
    azure_tenant_id: str
    azure_client_id: str
    azure_client_secret: str
    teams_chat_id: str            # chat to monitor (EOD messages)
    teams_agile_chat_id: str = "" # chat for summaries (defaults to teams_chat_id)
    teams_webhook_url: str        # public URL for Graph subscription


class WorkspaceUpdate(BaseModel):
    name: str | None = None
    azure_tenant_id: str | None = None
    azure_client_id: str | None = None
    azure_client_secret: str | None = None
    teams_chat_id: str | None = None
    teams_agile_chat_id: str | None = None
    teams_webhook_url: str | None = None
    slack_bot_token: str | None = None
    slack_signing_secret: str | None = None
    slack_channel_id: str | None = None


# ──────────────────────────────────────────────
# General workspace endpoints
# ──────────────────────────────────────────────


@router.get("/api/workspaces")
async def list_workspaces(
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    all_ws = await crud.list_workspaces(db)
    # Managers see only their own workspace; super_admin sees all
    if current_user.get("role") == "manager":
        workspace_id = current_user.get("workspace_id")
        return [w for w in all_ws if w["id"] == workspace_id]
    return all_ws


@router.get("/api/workspaces/{workspace_id}")
async def get_workspace(
    workspace_id: int,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    ws = await crud.get_workspace(db, workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    # Managers can only view their own workspace
    if current_user.get("role") == "manager" and current_user.get("workspace_id") != workspace_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return crud._workspace_to_dict(ws)


@router.patch("/api/workspaces/{workspace_id}")
async def update_workspace(
    workspace_id: int,
    body: WorkspaceUpdate,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    role = current_user.get("role")
    if role == "member":
        raise HTTPException(status_code=403, detail="Access denied")

    if role == "manager":
        # Managers can only update their own workspace
        if current_user.get("workspace_id") != workspace_id:
            raise HTTPException(status_code=403, detail="Access denied")
        # Managers can only change chat routing — never credentials
        MANAGER_ALLOWED = {"teams_agile_chat_id", "slack_channel_id"}
        fields = {k: v for k, v in body.model_dump(exclude_none=True).items() if k in MANAGER_ALLOWED}
    else:
        fields = body.model_dump(exclude_none=True)

    updated = await crud.update_workspace(db, workspace_id, fields)
    if not updated:
        raise HTTPException(status_code=404, detail="Workspace not found or nothing to update")
    return updated


@router.delete("/api/workspaces/{workspace_id}", dependencies=[Depends(require_super_admin)])
async def delete_workspace(workspace_id: int, db: AsyncSession = Depends(get_db)):
    ok = await crud.delete_workspace(db, workspace_id)
    if not ok:
        raise HTTPException(status_code=400, detail="Cannot delete default workspace or workspace not found")
    return {"status": "deleted", "id": workspace_id}


# ──────────────────────────────────────────────
# Teams connection flow
# ──────────────────────────────────────────────


@router.post("/api/workspaces/teams", dependencies=[Depends(require_super_admin)])
async def connect_teams_workspace(
    body: TeamsWorkspaceCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Store Azure AD credentials for a Teams workspace.
    After this, call POST /api/workspaces/{id}/subscribe to register the Graph subscription.
    """
    ws = await crud.create_workspace(
        db,
        name=body.name,
        platform="teams",
        azure_tenant_id=body.azure_tenant_id,
        azure_client_id=body.azure_client_id,
        azure_client_secret=body.azure_client_secret,
        teams_chat_id=body.teams_chat_id,
        teams_agile_chat_id=body.teams_agile_chat_id or body.teams_chat_id,
        teams_webhook_url=body.teams_webhook_url,
    )
    return {"status": "created", "workspace": ws}


@router.post("/api/workspaces/{workspace_id}/subscribe")
async def subscribe_workspace(workspace_id: int, db: AsyncSession = Depends(get_db)):
    """
    Register a Microsoft Graph subscription for this workspace's Teams chat.
    The clientState encodes the workspace ID so incoming notifications can be
    routed back to the right workspace.
    """
    from app.adapters.teams import TeamsAdapter

    ws = await crud.get_workspace(db, workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    if not ws.azure_tenant_id or not ws.teams_chat_id:
        raise HTTPException(status_code=400, detail="Teams credentials incomplete")

    adapter = TeamsAdapter.from_workspace(ws)
    headers = await adapter.get_app_headers()
    webhook_url = ws.teams_webhook_url or settings.WEBHOOK_NOTIFICATION_URL
    if not webhook_url:
        raise HTTPException(status_code=400, detail="teams_webhook_url not configured")

    from datetime import datetime, timedelta
    expiry = (datetime.utcnow() + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%S.0000000Z")

    payload = {
        "changeType": "created",
        "notificationUrl": f"{webhook_url.rstrip('/')}/api/graph-webhook",
        "resource": f"chats/{ws.teams_chat_id}/messages",
        "expirationDateTime": expiry,
        "clientState": adapter.client_state(),
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"{GRAPH_BASE_URL}/subscriptions", headers=headers, json=payload)
        if resp.status_code >= 400:
            raise HTTPException(
                status_code=resp.status_code,
                detail=f"Graph API error: {resp.text}",
            )
        data = resp.json()

    sub_id = data.get("id", "")
    await crud.update_workspace(db, workspace_id, {"teams_subscription_id": sub_id})
    logger.info("Teams subscription created: ws=%d, sub_id=%s", workspace_id, sub_id)
    return {"status": "subscribed", "subscription_id": sub_id, "expires": expiry}


@router.get("/api/workspaces/{workspace_id}/login")
async def workspace_login(workspace_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """Start delegated auth for this workspace (so it can send Teams messages)."""
    from app.adapters.teams import TeamsAdapter

    ws = await crud.get_workspace(db, workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    adapter = TeamsAdapter.from_workspace(ws)
    redirect_uri = (
        settings.REDIRECT_URI
        or f"{str(request.base_url).rstrip('/')}/api/workspaces/{workspace_id}/auth-callback"
    )
    return RedirectResponse(adapter.get_login_url(redirect_uri))


@router.get("/api/workspaces/{workspace_id}/auth-callback")
async def workspace_auth_callback(
    workspace_id: int,
    request: Request,
    code: str = "",
    error: str = "",
    db: AsyncSession = Depends(get_db),
):
    """OAuth callback — exchange code for delegated token for this workspace."""
    from app.adapters.teams import TeamsAdapter

    if error:
        return HTMLResponse(f"<h2>Login failed</h2><p>{error}</p>", status_code=400)
    if not code:
        return HTMLResponse("<h2>No authorization code received</h2>", status_code=400)

    ws = await crud.get_workspace(db, workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    adapter = TeamsAdapter.from_workspace(ws)
    redirect_uri = (
        settings.REDIRECT_URI
        or f"{str(request.base_url).rstrip('/')}/api/workspaces/{workspace_id}/auth-callback"
    )
    try:
        await adapter.exchange_code(code, redirect_uri)
        return HTMLResponse(
            f"<h2>Login successful!</h2>"
            f"<p>Workspace <b>{ws.name}</b> can now send Teams messages.</p>"
            f"<p>You can close this tab.</p>"
        )
    except Exception as e:
        return HTMLResponse(f"<h2>Login failed</h2><p>{e}</p>", status_code=500)


# ──────────────────────────────────────────────
# Slack OAuth flow
# ──────────────────────────────────────────────

SLACK_OAUTH_URL = "https://slack.com/oauth/v2/authorize"
SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access"

# Scopes needed:
#   chat:write          — post messages
#   channels:history    — read public channel messages
#   users:read          — resolve user display names
SLACK_SCOPES = "chat:write,channels:history,users:read,groups:history,im:history"


@router.get("/api/slack/install")
async def slack_install(request: Request, workspace_name: str = "Slack Workspace"):
    """
    Redirect to Slack's OAuth consent screen.
    Pass ?workspace_name=... to label this connection in the DB.
    """
    if not settings.SLACK_CLIENT_ID:
        raise HTTPException(status_code=400, detail="SLACK_CLIENT_ID not configured in .env")

    redirect_uri = f"{str(request.base_url).rstrip('/')}/api/slack/callback"
    state = workspace_name  # passed back in callback

    url = (
        f"{SLACK_OAUTH_URL}"
        f"?client_id={settings.SLACK_CLIENT_ID}"
        f"&scope={SLACK_SCOPES}"
        f"&redirect_uri={redirect_uri}"
        f"&state={state}"
    )
    return RedirectResponse(url)


@router.get("/api/slack/callback")
async def slack_callback(
    request: Request,
    code: str = "",
    state: str = "Slack Workspace",
    error: str = "",
    db: AsyncSession = Depends(get_db),
):
    """
    Slack sends the user back here after they approve the install.
    Exchange the code for a bot token and store in the DB.
    """
    if error:
        return HTMLResponse(f"<h2>Slack connection failed</h2><p>{error}</p>", status_code=400)
    if not code:
        return HTMLResponse("<h2>No authorization code received from Slack</h2>", status_code=400)

    if not settings.SLACK_CLIENT_ID or not settings.SLACK_CLIENT_SECRET:
        return HTMLResponse(
            "<h2>SLACK_CLIENT_ID / SLACK_CLIENT_SECRET not configured in .env</h2>",
            status_code=500,
        )

    redirect_uri = f"{str(request.base_url).rstrip('/')}/api/slack/callback"

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            SLACK_TOKEN_URL,
            data={
                "client_id": settings.SLACK_CLIENT_ID,
                "client_secret": settings.SLACK_CLIENT_SECRET,
                "code": code,
                "redirect_uri": redirect_uri,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    if not data.get("ok"):
        return HTMLResponse(
            f"<h2>Slack OAuth failed</h2><p>{data.get('error')}</p>", status_code=400
        )

    bot_token = data["access_token"]
    team_id = data.get("team", {}).get("id", "")
    team_name = data.get("team", {}).get("name", state)
    bot_user_id = data.get("bot_user_id", "")

    # Fetch the bot's default channel (first public channel it's in)
    # User can update this later via PATCH /api/workspaces/{id}
    channel_id = settings.SLACK_CHANNEL_ID or ""

    # Check if this Slack team is already connected
    existing = await crud.get_workspace_by_slack_team(db, team_id)
    if existing:
        await crud.update_workspace(db, existing.id, {
            "slack_bot_token": bot_token,
            "slack_team_id": team_id,
        })
        ws_name = existing.name
        ws_id = existing.id
    else:
        ws = await crud.create_workspace(
            db,
            name=team_name or state,
            platform="slack",
            slack_bot_token=bot_token,
            slack_signing_secret=settings.SLACK_SIGNING_SECRET,
            slack_channel_id=channel_id,
            slack_team_id=team_id,
        )
        ws_name = ws["name"]
        ws_id = ws["id"]

    logger.info("Slack workspace connected: team_id=%s, ws_id=%d", team_id, ws_id)
    return HTMLResponse(
        f"<h2>Slack connected!</h2>"
        f"<p>Workspace <b>{ws_name}</b> (team: {team_id}) is now connected.</p>"
        f"<p>Next: set the channel ID in Settings so the bot knows where to post summaries.</p>"
        f"<p>You can close this tab.</p>"
    )
