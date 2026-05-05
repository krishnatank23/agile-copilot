"""Member REST endpoints — consumed by the web UI."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.db.database import get_db
from app.db import crud
from app.db.models import Member

router = APIRouter(prefix="/api/members", tags=["members"])


def _workspace_id_for(user: dict) -> int | None:
    """Return workspace_id filter: None = all (super_admin), int = scoped."""
    role = user.get("role")
    if role == "super_admin":
        return None
    return user.get("workspace_id") or 1


@router.get("")
async def list_members(
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db),
):
    role = current_user["role"]

    if role == "member":
        member_id = current_user.get("member_id")
        all_members = await crud.list_all_members(db)
        return [m for m in all_members if m["id"] == member_id]

    workspace_id = _workspace_id_for(current_user)
    return await crud.list_all_members(db, workspace_id=workspace_id)
