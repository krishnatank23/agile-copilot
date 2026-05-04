"""Auth endpoints — login, me, and user creation."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import (
    create_token, hash_password, verify_password,
    get_current_user, require_manager, require_super_admin,
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
    role: str = "member"          # "super_admin" | "manager" | "member"
    member_id: int | None = None
    workspace_id: int | None = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    token = create_token(user.username, user.role, user.member_id, user.workspace_id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username,
        "member_id": user.member_id,
        "workspace_id": user.workspace_id,
    }


@router.get("/me")
async def me(current_user: Annotated[dict, Depends(get_current_user)]):
    return current_user


@router.post("/users")
async def create_user(
    body: CreateUserRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Create a login account. Managers can only create member accounts for their workspace."""
    caller_role = current_user.get("role")
    if caller_role not in ("manager", "super_admin"):
        raise HTTPException(status_code=403, detail="Manager access required")

    # Managers cannot create manager/super_admin accounts
    if caller_role == "manager" and body.role != "member":
        raise HTTPException(status_code=403, detail="Managers can only create member accounts")

    # Determine workspace_id for the new user
    if caller_role == "manager":
        workspace_id = current_user.get("workspace_id")
    else:
        workspace_id = body.workspace_id  # super_admin can assign any workspace

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
        workspace_id=workspace_id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "member_id": user.member_id,
        "workspace_id": user.workspace_id,
    }


@router.get("/users")
async def list_users(
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    caller_role = current_user.get("role")
    if caller_role not in ("manager", "super_admin"):
        raise HTTPException(status_code=403, detail="Manager access required")

    query = select(User).order_by(User.username)
    # Managers only see users in their workspace
    if caller_role == "manager":
        workspace_id = current_user.get("workspace_id")
        query = query.where(User.workspace_id == workspace_id)

    result = await db.execute(query)
    users = result.scalars().all()
    return [
        {"id": u.id, "username": u.username, "role": u.role, "member_id": u.member_id, "workspace_id": u.workspace_id}
        for u in users
    ]
