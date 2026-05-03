"""Member REST endpoints — consumed by the web UI."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.db.database import get_db
from app.db import crud
from app.db.models import Member

router = APIRouter(prefix="/api/members", tags=["members"])


@router.get("")
async def list_members(
    current_user: Annotated[dict, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db),
):
    all_members = await crud.list_all_members(db)
    if current_user["role"] == "member":
        member_id = current_user.get("member_id")
        return [m for m in all_members if m["id"] == member_id]
    return all_members
