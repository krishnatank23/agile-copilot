"""
CRUD operations — replaces excel_writer.py's interface.

All functions accept an AsyncSession and return plain dicts
so callers (pipeline, API routes) stay type-agnostic.
"""

import logging
from datetime import datetime
from typing import Any

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Workspace, Member, Task, BacklogItem

logger = logging.getLogger(__name__)

DEFAULT_WORKSPACE_ID = 1


# ──────────────────────────────────────────────
# Bootstrap
# ──────────────────────────────────────────────


async def ensure_default_workspace(db: AsyncSession) -> None:
    """
    Create the default workspace (id=1) if it doesn't exist yet.
    Seeds credentials from .env so existing deployments keep working without
    reconfiguring anything.
    """
    from app.config import settings

    result = await db.execute(select(Workspace).where(Workspace.id == DEFAULT_WORKSPACE_ID))
    ws = result.scalar_one_or_none()
    if ws is None:
        ws = Workspace(
            id=DEFAULT_WORKSPACE_ID,
            name="Default",
            platform="teams",
            # Seed from .env so the existing deployment keeps working
            azure_tenant_id=settings.AZURE_TENANT_ID,
            azure_client_id=settings.AZURE_CLIENT_ID,
            azure_client_secret=settings.AZURE_CLIENT_SECRET,
            teams_chat_id=settings.CHAT_ID,
            teams_agile_chat_id=settings.AGILE_CHAT_ID,
            teams_webhook_url=settings.WEBHOOK_NOTIFICATION_URL,
            slack_bot_token=settings.SLACK_BOT_TOKEN,
            slack_signing_secret=settings.SLACK_SIGNING_SECRET,
            slack_channel_id=settings.SLACK_CHANNEL_ID,
        )
        db.add(ws)
        await db.commit()
        logger.info("Created default workspace (seeded from .env)")
    else:
        # On every startup, sync .env values back into the DB row
        # so that users who still manage config via .env don't drift
        changed = False
        for field, val in [
            ("azure_tenant_id", settings.AZURE_TENANT_ID),
            ("azure_client_id", settings.AZURE_CLIENT_ID),
            ("azure_client_secret", settings.AZURE_CLIENT_SECRET),
            ("teams_chat_id", settings.CHAT_ID),
            ("teams_agile_chat_id", settings.AGILE_CHAT_ID),
            ("teams_webhook_url", settings.WEBHOOK_NOTIFICATION_URL),
        ]:
            if val and getattr(ws, field) != val:
                setattr(ws, field, val)
                changed = True
        if changed:
            await db.commit()


# ──────────────────────────────────────────────
# Workspace management
# ──────────────────────────────────────────────


def _workspace_to_dict(ws: Workspace, mask_secrets: bool = True) -> dict:
    return {
        "id": ws.id,
        "name": ws.name,
        "platform": ws.platform,
        "created_at": ws.created_at.isoformat() if ws.created_at else None,
        # Teams
        "azure_tenant_id": ws.azure_tenant_id or "",
        "azure_client_id": ws.azure_client_id or "",
        "azure_client_secret": "***" if mask_secrets and ws.azure_client_secret else (ws.azure_client_secret or ""),
        "teams_chat_id": ws.teams_chat_id or "",
        "teams_agile_chat_id": ws.teams_agile_chat_id or "",
        "teams_webhook_url": ws.teams_webhook_url or "",
        "teams_subscription_id": ws.teams_subscription_id or "",
        "teams_connected": bool(ws.azure_tenant_id and ws.azure_client_id and ws.teams_chat_id),
        # Slack
        "slack_bot_token": "***" if mask_secrets and ws.slack_bot_token else (ws.slack_bot_token or ""),
        "slack_signing_secret": "***" if mask_secrets and ws.slack_signing_secret else (ws.slack_signing_secret or ""),
        "slack_channel_id": ws.slack_channel_id or "",
        "slack_team_id": ws.slack_team_id or "",
        "slack_connected": bool(ws.slack_bot_token and ws.slack_channel_id),
    }


async def list_workspaces(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(Workspace).order_by(Workspace.id))
    return [_workspace_to_dict(ws) for ws in result.scalars().all()]


async def get_workspace(db: AsyncSession, workspace_id: int) -> Workspace | None:
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    return result.scalar_one_or_none()


async def get_workspace_by_slack_team(db: AsyncSession, slack_team_id: str) -> Workspace | None:
    result = await db.execute(
        select(Workspace).where(Workspace.slack_team_id == slack_team_id)
    )
    return result.scalar_one_or_none()


async def create_workspace(db: AsyncSession, name: str, platform: str, **kwargs) -> dict:
    ws = Workspace(name=name, platform=platform, **kwargs)
    db.add(ws)
    await db.commit()
    await db.refresh(ws)
    logger.info("Created workspace '%s' (platform=%s)", name, platform)
    return _workspace_to_dict(ws)


async def update_workspace(db: AsyncSession, workspace_id: int, fields: dict) -> dict | None:
    allowed = {
        "name", "platform",
        "azure_tenant_id", "azure_client_id", "azure_client_secret",
        "teams_chat_id", "teams_agile_chat_id", "teams_webhook_url", "teams_subscription_id",
        "slack_bot_token", "slack_signing_secret", "slack_channel_id", "slack_team_id",
    }
    values = {k: v for k, v in fields.items() if k in allowed and v is not None}
    if not values:
        return None
    await db.execute(update(Workspace).where(Workspace.id == workspace_id).values(**values))
    await db.commit()
    ws = await get_workspace(db, workspace_id)
    return _workspace_to_dict(ws) if ws else None


async def delete_workspace(db: AsyncSession, workspace_id: int) -> bool:
    if workspace_id == DEFAULT_WORKSPACE_ID:
        return False  # never delete the default
    ws = await get_workspace(db, workspace_id)
    if not ws:
        return False
    await db.delete(ws)
    await db.commit()
    return True


# ──────────────────────────────────────────────
# Member resolution (replaces resolve_sheet_name / list_all_sheets)
# ──────────────────────────────────────────────


async def get_or_create_member(
    db: AsyncSession,
    display_name: str,
    workspace_id: int = DEFAULT_WORKSPACE_ID,
) -> Member | None:
    """
    Find the Member row whose display_name best matches the given name.
    Creates a new Member if no match exists.
    Mirrors the fuzzy-first-name logic from resolve_sheet_name().
    """
    if not display_name or display_name == "Unknown":
        return None

    name_lower = display_name.strip().lower()
    result = await db.execute(
        select(Member).where(Member.workspace_id == workspace_id)
    )
    members = result.scalars().all()

    # Exact match
    for m in members:
        if m.display_name.strip().lower() == name_lower:
            return m

    # Partial match
    for m in members:
        ml = m.display_name.strip().lower()
        if name_lower in ml or ml in name_lower:
            logger.info("Member partial match: '%s' → '%s'", display_name, m.display_name)
            return m

    # First-name match
    first = name_lower.split()[0] if name_lower.split() else ""
    for m in members:
        mf = m.display_name.strip().lower().split()[0] if m.display_name.strip() else ""
        if first and mf == first:
            logger.info("Member first-name match: '%s' → '%s'", display_name, m.display_name)
            return m

    # Auto-create
    new_member = Member(workspace_id=workspace_id, display_name=display_name.strip())
    db.add(new_member)
    await db.commit()
    await db.refresh(new_member)
    logger.info("Created new member: '%s'", display_name)
    return new_member


async def list_members(
    db: AsyncSession,
    workspace_id: int = DEFAULT_WORKSPACE_ID,
) -> list[str]:
    """Return all member display names — replaces list_all_sheets()."""
    result = await db.execute(
        select(Member.display_name)
        .where(Member.workspace_id == workspace_id)
        .order_by(Member.display_name)
    )
    return [row[0] for row in result.all()]


async def list_all_members(
    db: AsyncSession,
    workspace_id: int | None = DEFAULT_WORKSPACE_ID,
) -> list[dict]:
    """Return member records as dicts for the API layer. workspace_id=None returns all."""
    query = select(Member).order_by(Member.display_name)
    if workspace_id is not None:
        query = query.where(Member.workspace_id == workspace_id)
    result = await db.execute(query)
    members = result.scalars().all()
    return [
        {
            "id": m.id,
            "display_name": m.display_name,
            "workspace_id": m.workspace_id,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in members
    ]


# ──────────────────────────────────────────────
# Task reads (replaces get_existing_rows / read_sheet_context)
# ──────────────────────────────────────────────


def _task_to_dict(task: Task) -> dict:
    """Convert a Task ORM row to the dict shape the pipeline expects."""
    return {
        "id": task.id,
        "member_id": task.member_id,
        "brand": task.brand or "",
        "activity_type": task.activity_type or "",
        "backlog": task.backlog or "",
        "sprint_backlog": task.sprint_backlog or "",
        "dependency": task.dependency or "",
        "deadline": task.deadline or "",
        "priority": task.priority or "Medium",
        "stage": task.stage or "WIP",
        "comments": task.comments or "",
        "expected_story_points": task.expected_story_points or 0,
        "actual_story_points": task.actual_story_points or 0,
        "sprint_end_date": task.sprint_end_date or "",
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "updated_at": task.updated_at.isoformat() if task.updated_at else None,
        "_sheet_row": task.id,   # pipeline uses _sheet_row for updates; we map it to DB id
    }


async def get_tasks_for_member(db: AsyncSession, member_id: int) -> list[dict]:
    """Return all tasks for a member as pipeline-compatible dicts."""
    result = await db.execute(
        select(Task)
        .where(Task.member_id == member_id)
        .order_by(Task.created_at)
    )
    return [_task_to_dict(t) for t in result.scalars().all()]


async def get_tasks_for_member_by_name(
    db: AsyncSession,
    display_name: str,
    workspace_id: int = DEFAULT_WORKSPACE_ID,
) -> list[dict]:
    """Convenience wrapper used by scheduler callbacks."""
    member = await get_or_create_member(db, display_name, workspace_id)
    if not member:
        return []
    return await get_tasks_for_member(db, member.id)


async def get_member_context(db: AsyncSession, member_id: int) -> dict:
    """
    Return the member's context dict consumed by parse_eod + validate_all.
    Mirrors read_sheet_context()'s return shape.
    """
    tasks = await get_tasks_for_member(db, member_id)

    result = await db.execute(
        select(BacklogItem)
        .where(BacklogItem.member_id == member_id, BacklogItem.promoted == False)  # noqa: E712
        .order_by(BacklogItem.created_at)
    )
    backlog_rows = result.scalars().all()

    # Build backlog_items in the shape task_router.route_tasks() expects:
    # [{"text": "...", "row_idx": <backlog_item_id>, "col_idx": 0}]
    backlog_items = [
        {"text": b.text, "row_idx": b.id, "col_idx": 0}
        for b in backlog_rows
    ]
    backlog_list = [b.text for b in backlog_rows]

    return {
        "backlog_items": backlog_items,
        "existing_rows": tasks,
        "backlog_list": backlog_list,
    }


async def list_tasks(
    db: AsyncSession,
    member_name: str | None = None,
    stage: str | None = None,
    workspace_id: int | None = DEFAULT_WORKSPACE_ID,
) -> list[dict]:
    """API endpoint helper — list tasks with optional filters. workspace_id=None returns all."""
    query = (
        select(Task, Member.display_name)
        .join(Member, Task.member_id == Member.id)
    )
    if workspace_id is not None:
        query = query.where(Member.workspace_id == workspace_id)
    if member_name:
        query = query.where(Member.display_name == member_name)
    if stage:
        query = query.where(Task.stage == stage)
    query = query.order_by(Member.display_name, Task.created_at.desc())

    result = await db.execute(query)
    rows = []
    for task, member_display in result.all():
        d = _task_to_dict(task)
        d["member_name"] = member_display
        rows.append(d)
    return rows


# ──────────────────────────────────────────────
# Task writes (replaces write_tasks / update_backlog_row)
# ──────────────────────────────────────────────


async def upsert_tasks(
    db: AsyncSession,
    new_tasks: list[dict],
    update_tasks: list[dict],
    member_id: int,
    sprint_end_date: str = "",
) -> dict:
    """
    Persist parsed tasks to the DB.
    new_tasks → INSERT, update_tasks → UPDATE (matched by _sheet_row = task.id).
    Replaces excel_writer.write_tasks().
    """
    results = {"appended": 0, "updated": 0, "errors": []}

    for task in update_tasks:
        task_id = task.get("_sheet_row")
        if not task_id:
            continue
        try:
            await db.execute(
                update(Task)
                .where(Task.id == task_id)
                .values(
                    brand=task.get("brand", ""),
                    activity_type=task.get("activity_type", ""),
                    backlog=task.get("backlog", ""),
                    dependency=task.get("dependency", ""),
                    deadline=task.get("deadline", ""),
                    priority=task.get("priority", "Medium"),
                    stage=task.get("stage", "WIP"),
                    comments=task.get("comments", ""),
                    expected_story_points=task.get("expected_story_points", 2),
                    updated_at=datetime.utcnow(),
                )
            )
            results["updated"] += 1
        except Exception as e:
            logger.error("Failed to update task %d: %s", task_id, e)
            results["errors"].append(f"Update {task_id} failed: {e}")

    for task in new_tasks:
        try:
            db.add(Task(
                member_id=member_id,
                brand=task.get("brand", ""),
                activity_type=task.get("activity_type", ""),
                backlog=task.get("backlog", ""),
                sprint_backlog=task.get("sprint_backlog", "Untitled task"),
                dependency=task.get("dependency", ""),
                deadline=task.get("deadline", ""),
                priority=task.get("priority", "Medium"),
                stage=task.get("stage", "WIP"),
                comments=task.get("comments", ""),
                expected_story_points=task.get("expected_story_points", 2),
                actual_story_points=0,
                sprint_end_date=sprint_end_date,
            ))
            results["appended"] += 1
        except Exception as e:
            logger.error("Failed to insert task '%s': %s", task.get("sprint_backlog"), e)
            results["errors"].append(f"Insert failed: {e}")

    await db.commit()
    return results


async def promote_backlog_item(
    db: AsyncSession,
    backlog_item_id: int,
    task: dict,
    member_id: int,
    sprint_end_date: str = "",
) -> None:
    """
    Mark a backlog item as promoted and create the sprint task linked to it.
    Replaces excel_writer.update_backlog_row().
    """
    await db.execute(
        update(BacklogItem)
        .where(BacklogItem.id == backlog_item_id)
        .values(promoted=True)
    )
    new_task = Task(
        member_id=member_id,
        backlog_item_id=backlog_item_id,
        brand=task.get("brand", ""),
        activity_type=task.get("activity_type", ""),
        backlog=task.get("backlog", ""),
        sprint_backlog=task.get("sprint_backlog", "Untitled task"),
        dependency=task.get("dependency", ""),
        deadline=task.get("deadline", ""),
        priority=task.get("priority", "Medium"),
        stage=task.get("stage", "WIP"),
        comments=task.get("comments", ""),
        expected_story_points=task.get("expected_story_points", 2),
        actual_story_points=0,
        sprint_end_date=sprint_end_date,
    )
    db.add(new_task)
    await db.commit()
    logger.info("Promoted backlog item %d → task '%s'", backlog_item_id, task.get("sprint_backlog"))


# ──────────────────────────────────────────────
# Backlog writes (replaces write_backlog_items)
# ──────────────────────────────────────────────


async def add_backlog_items(
    db: AsyncSession,
    member_id: int,
    items: list[str],
) -> int:
    """Append items to the member's backlog. Returns count written."""
    written = 0
    for text in items:
        text = text.strip()
        if not text:
            continue
        db.add(BacklogItem(member_id=member_id, text=text))
        written += 1
    await db.commit()
    logger.info("Added %d backlog items for member %d", written, member_id)
    return written


# ──────────────────────────────────────────────
# API task mutations
# ──────────────────────────────────────────────


async def update_task(db: AsyncSession, task_id: int, fields: dict) -> dict | None:
    """Partial update of a task — used by the web UI."""
    allowed = {
        "stage", "priority", "brand", "activity_type", "sprint_backlog",
        "dependency", "deadline", "comments", "expected_story_points", "actual_story_points",
    }
    values = {k: v for k, v in fields.items() if k in allowed}
    if not values:
        return None

    values["updated_at"] = datetime.utcnow()
    await db.execute(update(Task).where(Task.id == task_id).values(**values))
    await db.commit()

    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    return _task_to_dict(task) if task else None


# ──────────────────────────────────────────────
# Dashboard aggregates
# ──────────────────────────────────────────────


async def get_sprint_progress(
    db: AsyncSession,
    workspace_id: int | None = DEFAULT_WORKSPACE_ID,
) -> list[dict]:
    """Per-member sprint progress (actual vs expected story points). workspace_id=None returns all."""
    query = (
        select(Member)
        .options(selectinload(Member.tasks), selectinload(Member.workspace))
        .order_by(Member.display_name)
    )
    if workspace_id is not None:
        query = query.where(Member.workspace_id == workspace_id)
    result = await db.execute(query)
    members = result.scalars().all()

    progress = []
    for m in members:
        tasks = [t for t in m.tasks if "total" not in t.sprint_backlog.lower()]
        expected = sum(t.expected_story_points or 0 for t in tasks)
        actual = sum(t.actual_story_points or 0 for t in tasks)
        wip = sum(1 for t in tasks if t.stage == "WIP")
        closed = sum(1 for t in tasks if t.stage == "Closed")
        approval = sum(1 for t in tasks if t.stage == "Sent for Approval")
        ws_name = m.workspace.name if m.workspace else ""
        progress.append({
            "member": m.display_name,
            "member_id": m.id,
            "workspace_id": m.workspace_id,
            "workspace_name": ws_name,
            "total_tasks": len(tasks),
            "wip": wip,
            "closed": closed,
            "sent_for_approval": approval,
            "expected_sp": expected,
            "actual_sp": actual,
            "pct": round((actual / expected) * 100) if expected > 0 else 0,
        })
    return progress


async def get_wip_summary(
    db: AsyncSession,
    workspace_id: int | None = DEFAULT_WORKSPACE_ID,
) -> list[dict]:
    """Top WIP tasks per member for the morning summary. workspace_id=None returns all."""
    query = (
        select(Member)
        .options(selectinload(Member.tasks))
        .order_by(Member.display_name)
    )
    if workspace_id is not None:
        query = query.where(Member.workspace_id == workspace_id)
    result = await db.execute(query)
    members = result.scalars().all()

    summary = []
    for m in members:
        wip = [_task_to_dict(t) for t in m.tasks if t.stage == "WIP" and t.sprint_backlog]
        if wip:
            summary.append({"member": m.display_name, "wip_tasks": wip})
    return summary
