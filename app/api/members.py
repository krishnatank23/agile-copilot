"""Member REST endpoints — consumed by the web UI."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.db.database import get_db
from app.db import crud
from app.db.models import Member

router = APIRouter(prefix="/api/members", tags=["members"])


class CreateMemberRequest(BaseModel):
    display_name: str
    workspace_id: int | None = None


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
    # Return the full workspace team so UI dropdowns can show every teammate.
    workspace_id = _workspace_id_for(current_user)
    return await crud.list_all_members(db, workspace_id=workspace_id)


@router.post("")
async def create_member(
    body: CreateMemberRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    role = current_user.get("role")
    if role not in ("manager", "super_admin"):
        raise HTTPException(status_code=403, detail="Manager access required")

    display_name = body.display_name.strip()
    if not display_name:
        raise HTTPException(status_code=400, detail="display_name is required")

    if role == "manager":
        workspace_id = current_user.get("workspace_id") or 1
    else:
        workspace_id = body.workspace_id or 1

    existing = await db.execute(
        select(Member).where(
            Member.workspace_id == workspace_id,
            Member.display_name == display_name,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Member already exists")

    member = Member(display_name=display_name, workspace_id=workspace_id)
    db.add(member)
    await db.commit()
    await db.refresh(member)

    return {
        "id": member.id,
        "display_name": member.display_name,
        "workspace_id": member.workspace_id,
        "created_at": member.created_at,
    }
