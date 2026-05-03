"""Auth endpoints — login, me, and manager-only user creation."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import (
    create_token, hash_password, verify_password,
    get_current_user, require_manager,
)
from app.db.database import get_db
from app.db.models import User, Member

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: str = "member"        # "manager" | "member"
    member_id: int | None = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    token = create_token(user.username, user.role, user.member_id)
    return {"access_token": token, "token_type": "bearer", "role": user.role, "username": user.username, "member_id": user.member_id}


@router.get("/me")
async def me(current_user: Annotated[dict, Depends(get_current_user)]):
    return current_user


@router.post("/users", dependencies=[Depends(require_manager)])
async def create_user(body: CreateUserRequest, db: AsyncSession = Depends(get_db)):
    """Manager creates a login account for a team member (or another manager)."""
    existing = await db.execute(select(User).where(User.username == body.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already taken")

    if body.member_id:
        member = await db.get(Member, body.member_id)
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")

    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        role=body.role,
        member_id=body.member_id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {"id": user.id, "username": user.username, "role": user.role, "member_id": user.member_id}


@router.get("/users", dependencies=[Depends(require_manager)])
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.username))
    users = result.scalars().all()
    return [{"id": u.id, "username": u.username, "role": u.role, "member_id": u.member_id} for u in users]
