"""
Agile Copilot — FastAPI application.

Storage: SQLite (via SQLAlchemy async) — replaces SharePoint Excel.
Platforms: MS Teams (Graph API) + Slack (Events API).

Endpoints:
  POST /api/eod-webhook        — receive EOD payload (manual / Power Automate)
  POST /api/graph-webhook      — receive Graph API subscription notifications (Teams)
  GET  /api/graph-webhook      — Graph API subscription validation handshake
  POST /api/slack-webhook      — receive Slack Events API notifications
  POST /api/subscribe          — create/renew Graph API subscription
  POST /api/notify-wip         — send WIP task summary to Teams/Slack
  POST /api/eod-reminder       — send EOD reminder
  POST /api/morning-summary    — send AI-prioritized morning summary
  GET  /api/login              — start delegated Teams auth
  GET  /api/auth-callback      — OAuth callback
  GET  /api/tasks              — list tasks (web UI)
  PATCH /api/tasks/{id}        — update task (web UI)
  GET  /api/members            — list members (web UI)
  GET  /api/dashboard/*        — dashboard aggregates (web UI)
  GET  /health                 — health check
"""

import asyncio
import hashlib
import hmac as _hmac
import logging
from contextlib import asynccontextmanager
from datetime import date

import httpx
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, HTMLResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings, get_sprint_end_date
from app.teams_capture import extract_metadata, is_eod_message, validate_eod
from app.ai_parser import parse_eod
from app.validator import validate_all
from app.task_router import route_tasks
from app.subscription_manager import subscription_manager
from app.scheduler import scheduler

from app.db.database import init_db, get_db, AsyncSessionLocal
from app.db import crud
from app.adapters.teams import TeamsAdapter, get_default_adapter
from app.adapters.slack import SlackAdapter

from app.api.tasks import router as tasks_router
from app.api.members import router as members_router
from app.api.dashboard import router as dashboard_router
from app.api.workspaces import router as workspaces_router
from app.api.auth import router as auth_router

# ──────────────────────────────────────────────
# Logging
# ──────────────────────────────────────────────

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL, logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# App lifecycle
# ──────────────────────────────────────────────


async def _seed_manager(db) -> None:
    """Create the default manager account if it doesn't exist yet."""
    from sqlalchemy import select
    from app.db.models import User
    from app.auth import hash_password
    result = await db.execute(select(User).where(User.username == "manager"))
    if result.scalar_one_or_none() is None:
        db.add(User(username="manager", password_hash=hash_password(settings.MANAGER_PASSWORD), role="manager"))
        await db.commit()
        logger.info("Created default manager account (username: manager)")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Agile Copilot starting up")

    # Initialise database (create tables if they don't exist)
    await init_db()

    async with AsyncSessionLocal() as db:
        await crud.ensure_default_workspace(db)
        await _seed_manager(db)

    # Delayed Teams subscription (Teams only — skip if not configured)
    if settings.AZURE_CLIENT_ID and settings.CHAT_ID:
        async def _delayed_subscribe():
            await asyncio.sleep(5)
            try:
                await subscription_manager.ensure_active()
                logger.info("Teams subscription active on startup")
            except Exception as e:
                logger.warning("Could not create Teams subscription: %s", e)

        asyncio.create_task(_delayed_subscribe())
        subscription_manager.start_auto_renewal()

    scheduler.start(
        eod_callback=_send_eod_reminder,
        morning_callback=_send_agile_reminder,
        progress_callback=_send_progress_report,
        todo_callback=_send_morning_summary,
    )

    yield

    scheduler.stop()
    if settings.AZURE_CLIENT_ID and settings.CHAT_ID:
        subscription_manager.stop_auto_renewal()
        if subscription_manager.is_active:
            try:
                await subscription_manager.delete_subscription()
            except Exception as e:
                logger.warning("Failed to delete Teams subscription: %s", e)

    logger.info("Agile Copilot shutting down")


# Dedup cache — prevents processing the same Graph/Slack notification twice
_processed_messages: set[str] = set()
_MAX_CACHE_SIZE = 200

app = FastAPI(
    title="Agile Copilot",
    description="AI-powered agile tracking bot with Teams + Slack support.",
    version="2.0.0",
    lifespan=lifespan,
)

# Allow the Next.js dev server (port 3000) and any production domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(auth_router)
app.include_router(tasks_router)
app.include_router(members_router)
app.include_router(dashboard_router)
app.include_router(workspaces_router)


# ──────────────────────────────────────────────
# Pydantic models
# ──────────────────────────────────────────────


class EODPayload(BaseModel):
    sender: str = ""
    message: str = ""
    timestamp: str = ""


class PipelineResult(BaseModel):
    status: str
    member: str
    tasks_parsed: int
    tasks_appended: int
    tasks_updated: int
    errors: list[str] = []


# ──────────────────────────────────────────────
# Adapter resolution — load per-workspace adapter from DB
# ──────────────────────────────────────────────


async def _get_teams_adapter(workspace_id: int) -> TeamsAdapter:
    """Load the TeamsAdapter for a specific workspace (cached per request)."""
    async with AsyncSessionLocal() as db:
        ws = await crud.get_workspace(db, workspace_id)
    if ws:
        return TeamsAdapter.from_workspace(ws)
    return get_default_adapter()


async def _get_slack_adapter(workspace_id: int) -> SlackAdapter:
    async with AsyncSessionLocal() as db:
        ws = await crud.get_workspace(db, workspace_id)
    if ws:
        return SlackAdapter.from_workspace(ws)
    return SlackAdapter.from_settings()


# ──────────────────────────────────────────────
# Message sending (delegates to platform adapters)
# ──────────────────────────────────────────────


async def _send_teams_message(
    content: str,
    chat_id: str | None = None,
    workspace_id: int = 1,
) -> None:
    adapter = await _get_teams_adapter(workspace_id)
    await adapter.send_message(content, channel_id=chat_id)


async def _send_agile_message(content: str, workspace_id: int = 1) -> None:
    await _send_teams_message(content, workspace_id=workspace_id)


# ──────────────────────────────────────────────
# EOD processing pipeline (DB-backed)
# ──────────────────────────────────────────────


async def _process_backlog_command(sender: str, message: str, db: AsyncSession) -> None:
    """Handle /backlog command — append items to the member's backlog in the DB."""
    body = message[len("/backlog"):].strip()
    lines = [l.strip().lstrip("-•*1234567890.)").strip() for l in body.splitlines()]
    items = [l for l in lines if l]
    if not items and body:
        items = [body]
    if not items:
        return

    member = await crud.get_or_create_member(db, sender)
    if not member:
        logger.warning("/backlog: no member found for '%s'", sender)
        return

    written = await crud.add_backlog_items(db, member.id, items)
    reply = (
        f"<b>Backlog updated</b> — added {written} item(s) for {sender}:<br>"
        + "<br>".join(f"&bull; {i}" for i in items if i.strip())
    )
    await _send_teams_message(reply)


async def _process_eod(
    sender: str, clean_message: str, timestamp: str, db: AsyncSession
) -> PipelineResult:
    """
    Full EOD pipeline (DB-backed):
      1. Resolve member in DB (create if new)
      2. Load context (existing tasks + backlog) from DB
      3. Parse EOD with AI (Gemini → Groq → local)
      4. Validate (dedup, defaults, schema)
      5. Route (backlog promotion check)
      6. Write results to DB
    """
    logger.info("Processing EOD from '%s'", sender)

    member = await crud.get_or_create_member(db, sender)
    if not member:
        return PipelineResult(
            status="skipped", member=sender,
            tasks_parsed=0, tasks_appended=0, tasks_updated=0,
            errors=[f"Could not resolve member for '{sender}'"],
        )

    sprint_end = get_sprint_end_date()
    today = date.today().isoformat()

    try:
        sheet_ctx = await crud.get_member_context(db, member.id)
    except Exception as e:
        logger.warning("Failed to read member context: %s — continuing empty", e)
        sheet_ctx = {"backlog_items": [], "existing_rows": [], "backlog_list": []}

    context = {
        "member_name": sender,
        "today_date": today,
        "sprint_end_date": sprint_end,
        "backlog_list": sheet_ctx["backlog_list"],
        "existing_rows": sheet_ctx["existing_rows"],
        "recent_eod_history": sheet_ctx.get("recent_eod_history", []),
    }

    logger.info(
        "Context: %d existing rows, %d backlog items",
        len(sheet_ctx["existing_rows"]), len(sheet_ctx["backlog_list"]),
    )

    try:
        await crud.add_eod_message(db, member.id, clean_message, timestamp)
    except Exception as e:
        logger.warning("Failed to store EOD history: %s", e)

    # Parse
    logger.info("Clean message:\n%s", clean_message)
    try:
        tasks = await parse_eod(clean_message, context)
    except Exception as e:
        logger.error("All parsers failed: %s", e)
        return PipelineResult(
            status="error", member=sender,
            tasks_parsed=0, tasks_appended=0, tasks_updated=0,
            errors=[f"Parsing failed: {e}"],
        )

    if not tasks:
        return PipelineResult(
            status="empty", member=sender,
            tasks_parsed=0, tasks_appended=0, tasks_updated=0,
        )

    # Validate
    new_tasks, update_tasks = await validate_all(
        tasks, sheet_ctx["existing_rows"], sheet_ctx["backlog_list"], sprint_end
    )

    # Route — backlog promotion check
    routed_tasks, inplace_updates = route_tasks(new_tasks, sheet_ctx["backlog_items"])

    # Write backlog-promoted tasks
    promoted_count = 0
    for task in inplace_updates:
        backlog_item_id = task.get("_backlog_row_idx")
        if backlog_item_id:
            try:
                await crud.promote_backlog_item(db, backlog_item_id, task, member.id, sprint_end)
                promoted_count += 1
            except Exception as e:
                logger.warning("Failed to promote backlog item %d: %s", backlog_item_id, e)

    # Write new + updated tasks
    try:
        write_result = await crud.upsert_tasks(
            db, routed_tasks, update_tasks, member.id, sprint_end
        )
    except Exception as e:
        logger.error("DB write failed: %s", e)
        return PipelineResult(
            status="error", member=sender,
            tasks_parsed=len(tasks),
            tasks_appended=0, tasks_updated=0,
            errors=[f"DB write failed: {e}"],
        )

    return PipelineResult(
        status="success",
        member=sender,
        tasks_parsed=len(tasks),
        tasks_appended=write_result.get("appended", 0),
        tasks_updated=write_result.get("updated", 0) + promoted_count,
        errors=write_result.get("errors", []),
    )


# ──────────────────────────────────────────────
# Delegated Teams auth
# ──────────────────────────────────────────────


@app.get("/api/login")
async def login(request: Request):
    from app.graph_auth import graph_auth
    redirect_uri = settings.REDIRECT_URI or f"{str(request.base_url).rstrip('/')}/api/auth-callback"
    return RedirectResponse(graph_auth.get_login_url(redirect_uri))


@app.get("/api/auth-callback")
async def auth_callback(request: Request, code: str = "", error: str = ""):
    from app.graph_auth import graph_auth
    if error:
        return HTMLResponse(f"<h2>Login failed</h2><p>{error}</p>", status_code=400)
    if not code:
        return HTMLResponse("<h2>No authorization code received</h2>", status_code=400)
    redirect_uri = settings.REDIRECT_URI or f"{str(request.base_url).rstrip('/')}/api/auth-callback"
    try:
        await graph_auth.exchange_code(code, redirect_uri)
        return HTMLResponse(
            "<h2>Login successful!</h2>"
            "<p>Agile Copilot can now send messages to your Teams chats.</p>"
            "<p>You can close this tab.</p>"
        )
    except Exception as e:
        return HTMLResponse(f"<h2>Login failed</h2><p>{e}</p>", status_code=500)


# ──────────────────────────────────────────────
# Health check
# ──────────────────────────────────────────────


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "agile-copilot",
        "version": "2.0.0",
        "storage": "sqlite",
        "subscription_active": subscription_manager.is_active if settings.AZURE_CLIENT_ID else False,
    }


# ──────────────────────────────────────────────
# Direct EOD webhook (Power Automate / manual)
# ──────────────────────────────────────────────


@app.post("/api/eod-webhook", response_model=PipelineResult)
async def eod_webhook(payload: EODPayload, request: Request):
    async with AsyncSessionLocal() as db:
        metadata = extract_metadata(payload.model_dump())
        sender = metadata["sender"]
        clean_message = metadata["clean_message"]
        timestamp = metadata["timestamp"]

        if not validate_eod(clean_message):
            raise HTTPException(status_code=400, detail="Not a valid EOD message.")

        return await _process_eod(sender, clean_message, timestamp, db)


# ──────────────────────────────────────────────
# Teams Graph API webhook
# ──────────────────────────────────────────────


@app.get("/api/graph-webhook")
async def graph_webhook_validation(request: Request):
    token = request.query_params.get("validationToken")
    if token:
        logger.info("Graph API validation handshake")
        return Response(content=token, media_type="text/plain")
    return Response(content="OK", media_type="text/plain")


def _workspace_id_from_client_state(client_state: str) -> int | None:
    """
    Parse the workspace ID from the clientState header.

    New format:  "agile-copilot-{workspace_id}"  → int
    Legacy format: "agile-copilot-secret"         → default workspace (1)
    """
    if client_state == "agile-copilot-secret":
        return 1
    if client_state.startswith("agile-copilot-"):
        try:
            return int(client_state.split("-")[-1])
        except ValueError:
            pass
    return None


@app.post("/api/graph-webhook")
async def graph_webhook_notification(request: Request):
    token = request.query_params.get("validationToken")
    if token:
        return Response(content=token, media_type="text/plain")

    body = await request.json()
    notifications = body.get("value", [])

    for notification in notifications:
        client_state = notification.get("clientState", "")
        workspace_id = _workspace_id_from_client_state(client_state)
        if workspace_id is None:
            logger.warning("Unknown clientState '%s' — skipping notification", client_state)
            continue

        resource = notification.get("resource", "")

        if resource in _processed_messages:
            logger.info("Duplicate notification '%s' — skipping", resource)
            continue
        if len(_processed_messages) > _MAX_CACHE_SIZE:
            _processed_messages.clear()
        _processed_messages.add(resource)

        try:
            message_data = await _fetch_teams_message(resource)
        except Exception as e:
            logger.error("Failed to fetch Teams message: %s", e)
            continue

        # Self-loop prevention — use workspace's own client_id if available
        async with AsyncSessionLocal() as db:
            ws = await crud.get_workspace(db, workspace_id)
        ws_client_id = (ws.azure_client_id if ws else None) or settings.AZURE_CLIENT_ID
        from_info = message_data.get("from", {})
        app_info = from_info.get("application")
        if app_info and app_info.get("id") == ws_client_id:
            logger.info("Skipping bot's own message (ws=%d)", workspace_id)
            continue
        msg_body = message_data.get("body", {}).get("content", "")
        if any(tag in msg_body for tag in ["Good Morning! Daily Focus", "EOD Reminder", "WIP Task Summary"]):
            logger.info("Skipping bot-generated message (ws=%d)", workspace_id)
            continue

        metadata = extract_metadata(message_data)
        clean = metadata["clean_message"].strip()
        sender = metadata["sender"]

        async with AsyncSessionLocal() as db:
            if clean.lower().startswith("/backlog"):
                await _process_backlog_command(sender, clean, db)
                continue

            if not is_eod_message(clean):
                logger.info("Not an EOD from '%s' — skipping", sender)
                continue
            if not validate_eod(clean):
                logger.info("No valid tasks in message from '%s' — skipping", sender)
                continue

            result = await _process_eod(sender, clean, metadata["timestamp"], db, workspace_id=workspace_id)
            logger.info(
                "EOD processed: ws=%d member=%s parsed=%d appended=%d updated=%d",
                workspace_id, result.member, result.tasks_parsed, result.tasks_appended, result.tasks_updated,
            )

    return Response(status_code=202)


async def _fetch_teams_message(resource: str, workspace_id: int = 1) -> dict:
    adapter = await _get_teams_adapter(workspace_id)
    headers = await adapter.get_app_headers()
    url = f"{GRAPH_BASE_URL}/{resource.lstrip('/')}"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, headers=headers)
        resp.raise_for_status()
        return resp.json()


# ──────────────────────────────────────────────
# Slack Events API webhook
# ──────────────────────────────────────────────


@app.post("/api/slack-webhook")
async def slack_webhook(request: Request):
    """
    Receive Slack Events API notifications.
    Routes to the correct workspace by matching the Slack team_id in the payload.
    Handles:
      - url_verification challenge
      - message events (team member EOD / /backlog commands)
    """
    body_bytes = await request.body()
    body = await request.json()

    # Identify workspace by Slack team_id
    slack_team_id = body.get("team_id", "")
    workspace_id = 1  # default
    slack_ws = None
    if slack_team_id:
        async with AsyncSessionLocal() as db:
            slack_ws = await crud.get_workspace_by_slack_team(db, slack_team_id)
        if slack_ws:
            workspace_id = slack_ws.id

    # Build a per-workspace SlackAdapter for signature verification
    adapter = (
        SlackAdapter.from_workspace(slack_ws)
        if slack_ws
        else SlackAdapter.from_settings()
    )

    # Verify Slack signature
    ts = request.headers.get("x-slack-request-timestamp", "")
    sig = request.headers.get("x-slack-signature", "")
    if not adapter.verify_signature(body_bytes, ts, sig):
        raise HTTPException(status_code=403, detail="Invalid Slack signature")

    # URL verification challenge
    if body.get("type") == "url_verification":
        return {"challenge": body["challenge"]}

    event = body.get("event", {})
    if event.get("type") != "message" or event.get("subtype"):
        return Response(status_code=200)
    if event.get("bot_id"):
        return Response(status_code=200)

    text = event.get("text", "").strip()
    user_id = event.get("user", "")
    sender = await adapter.resolve_user_name(user_id) if user_id else "Unknown"

    msg_id = event.get("ts", "")
    if msg_id in _processed_messages:
        return Response(status_code=200)
    if len(_processed_messages) > _MAX_CACHE_SIZE:
        _processed_messages.clear()
    _processed_messages.add(msg_id)

    async with AsyncSessionLocal() as db:
        if text.lower().startswith("/backlog"):
            await _process_backlog_command(sender, text, db)
        elif is_eod_message(text) and validate_eod(text):
            result = await _process_eod(sender, text, "", db, workspace_id=workspace_id)
            logger.info(
                "Slack EOD processed: ws=%d member=%s parsed=%d appended=%d",
                workspace_id, result.member, result.tasks_parsed, result.tasks_appended,
            )

    return Response(status_code=200)


async def _resolve_slack_user(user_id: str) -> str:
    """Fallback for resolving Slack user without a workspace adapter."""
    if not settings.SLACK_BOT_TOKEN:
        return user_id
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://slack.com/api/users.info",
                headers={"Authorization": f"Bearer {settings.SLACK_BOT_TOKEN}"},
                params={"user": user_id},
            )
            data = resp.json()
            if data.get("ok"):
                profile = data.get("user", {}).get("profile", {})
                return profile.get("display_name") or profile.get("real_name") or user_id
    except Exception as e:
        logger.warning("Could not resolve Slack user %s: %s", user_id, e)
    return user_id


# ──────────────────────────────────────────────
# Teams subscription management
# ──────────────────────────────────────────────


@app.post("/api/subscribe")
async def create_subscription():
    try:
        result = await subscription_manager.ensure_active()
        return {"status": "ok", "subscription": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Subscription failed: {e}")


# ──────────────────────────────────────────────
# Scheduled notification helpers
# ──────────────────────────────────────────────


async def _ai_prioritize_tasks(member: str, wip_tasks: list[dict]) -> list[dict]:
    """Use Gemini to pick the top 5 most important WIP tasks for a member."""
    import json, httpx
    if not settings.GEMINI_API_KEY or len(wip_tasks) <= 5:
        return wip_tasks[:5]

    task_lines = [
        f"- {t.get('sprint_backlog', '')} "
        f"(brand: {t.get('brand','')}, priority: {t.get('priority','')}, sp: {t.get('expected_story_points',0)})"
        for t in wip_tasks
    ]
    prompt = (
        f"You are an agile PM. {member} has these WIP tasks:\n\n"
        + "\n".join(task_lines)
        + "\n\nPick the TOP 5 to focus on today. "
        "Return ONLY a JSON array of exact task names, ordered by priority."
    )
    try:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"gemini-2.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
        )
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                url,
                json={"contents": [{"parts": [{"text": prompt}]}],
                      "generationConfig": {"responseMimeType": "application/json"}},
            )
            resp.raise_for_status()
            text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        top_names = json.loads(text)
        if not isinstance(top_names, list):
            return wip_tasks[:5]
        name_map = {t["sprint_backlog"]: t for t in wip_tasks}
        ordered = [name_map[n] for n in top_names[:5] if n in name_map]
        return ordered if ordered else wip_tasks[:5]
    except Exception as e:
        logger.warning("AI prioritization failed for %s: %s", member, e)
        return wip_tasks[:5]


def _progress_bar(actual: int, expected: int, width: int = 10) -> str:
    if expected <= 0:
        return "░" * width
    pct = min(actual / expected, 1.0)
    filled = round(pct * width)
    return "█" * filled + "░" * (width - filled)


async def _send_eod_reminder():
    async with AsyncSessionLocal() as db:
        members = await crud.list_members(db)
    member_list = ", ".join(members) if members else "Team"
    html = (
        "<b>EOD Reminder</b><br><br>"
        f"Hey {member_list}! It's 6 PM — time to submit your End-of-Day update.<br><br>"
        "Please share what you worked on today in the format:<br>"
        "&bull; Task 1 — status<br>"
        "&bull; Task 2 — status"
    )
    await _send_agile_message(html)
    logger.info("EOD reminder sent")


async def _send_agile_reminder():
    async with AsyncSessionLocal() as db:
        members = await crud.list_members(db)
    member_list = ", ".join(members) if members else "Team"
    html = f"<b>Agile Update Reminder</b> — Hey {member_list}! Please update your agile sheet."
    await _send_agile_message(html)


async def _send_morning_summary():
    async with AsyncSessionLocal() as db:
        wip_data = await crud.get_wip_summary(db)

    if not wip_data:
        return

    all_summaries = []
    for entry in wip_data:
        member = entry["member"]
        wip_tasks = entry["wip_tasks"]
        top = await _ai_prioritize_tasks(member, wip_tasks)
        lines = []
        for i, t in enumerate(top, 1):
            brand = t.get("brand", "")
            activity = t.get("activity_type", "")
            name = t.get("sprint_backlog", "")
            tag = f" ({brand} - {activity})" if brand and activity else f" ({brand or activity})" if brand or activity else ""
            lines.append(f"{i}. {name}{tag}")
        remaining = len(wip_tasks) - len(top)
        summary = f"<b>{member}</b> — Top {len(top)} focus tasks:<br>" + "<br>".join(lines)
        if remaining > 0:
            summary += f"<br><i>+{remaining} more WIP tasks</i>"
        all_summaries.append(summary)

    today = date.today().strftime("%A, %B %d")
    html = (
        f"<b>Good Morning! Daily Focus — {today}</b><br><br>"
        + "<br><br>".join(all_summaries)
        + "<br><br><i>Prioritized by AI based on effort, priority, and project balance.</i>"
    )
    await _send_agile_message(html)
    logger.info("Morning summary sent for %d members", len(all_summaries))


async def _send_progress_report():
    async with AsyncSessionLocal() as db:
        progress = await crud.get_sprint_progress(db)

    if not progress:
        return

    lines = []
    total_actual = total_expected = 0
    for p in progress:
        exp, act = p["expected_sp"], p["actual_sp"]
        pct = p["pct"]
        bar = _progress_bar(act, exp)
        lines.append(
            f"<b>{p['member']}</b> — {act}/{exp} SP ({pct}%) {bar} &nbsp;|&nbsp; "
            f"{p['closed']}/{p['total_tasks']} tasks closed"
        )
        total_actual += act
        total_expected += exp

    today = date.today().strftime("%A, %B %d")
    team_pct = round((total_actual / total_expected) * 100) if total_expected > 0 else 0
    team_bar = _progress_bar(total_actual, total_expected)
    html = (
        f"<b>Sprint Progress — {today}</b><br><br>"
        + "<br>".join(lines)
        + f"<br><br><b>Team Total — {total_actual}/{total_expected} SP ({team_pct}%) {team_bar}</b>"
    )
    await _send_agile_message(html)
    logger.info("Progress report sent")


# ──────────────────────────────────────────────
# Manual trigger endpoints
# ──────────────────────────────────────────────


@app.post("/api/test-message")
async def test_message():
    await _send_teams_message("<b>Agile Copilot 2.0 is live!</b> Storage migrated to SQLite. 🎉")
    return {"status": "ok"}


@app.post("/api/eod-reminder")
async def eod_reminder():
    try:
        await _send_eod_reminder()
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/agile-reminder")
async def agile_reminder():
    try:
        await _send_agile_reminder()
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/morning-summary")
async def morning_summary(send: bool = True):
    async with AsyncSessionLocal() as db:
        wip_data = await crud.get_wip_summary(db)
    if not wip_data:
        return {"status": "ok", "message": "No WIP tasks found", "data": []}
    if not send:
        return {"status": "preview", "data": wip_data}
    try:
        await _send_morning_summary()
        return {"status": "ok", "members_notified": len(wip_data), "data": wip_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/progress-report")
async def progress_report(send: bool = True):
    async with AsyncSessionLocal() as db:
        data = await crud.get_sprint_progress(db)
    if not send:
        return {"status": "preview", "data": data}
    try:
        await _send_progress_report()
        return {"status": "ok", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/notify-wip")
async def notify_wip(send: bool = True):
    async with AsyncSessionLocal() as db:
        wip_data = await crud.get_wip_summary(db)
    if not wip_data:
        return {"status": "ok", "message": "No WIP tasks", "data": []}
    if not send:
        return {"status": "preview", "data": wip_data}
    all_summaries = []
    for entry in wip_data:
        member = entry["member"]
        wip_tasks = entry["wip_tasks"]
        top = await _ai_prioritize_tasks(member, wip_tasks)
        lines = [
            f"{i}. {t.get('sprint_backlog','')} ({t.get('brand','')} - {t.get('activity_type','')})"
            for i, t in enumerate(top, 1)
        ]
        all_summaries.append(f"<b>{member}</b>:<br>" + "<br>".join(lines))
    html = "<b>WIP Task Summary</b><br><br>" + "<br><br>".join(all_summaries)
    try:
        await _send_agile_message(html)
        return {"status": "ok", "data": wip_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ──────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
