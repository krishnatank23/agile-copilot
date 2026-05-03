"""Member REST endpoints — consumed by the web UI."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db import crud

router = APIRouter(prefix="/api/members", tags=["members"])


@router.get("")
async def list_members(db: AsyncSession = Depends(get_db)):
    return await crud.list_all_members(db)
