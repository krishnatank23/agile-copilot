"""
Database setup — SQLite via SQLAlchemy async.
Replaces the Microsoft Graph / Excel storage layer.
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.db.models import Base

DATABASE_URL = "sqlite+aiosqlite:///./agile_copilot.db"

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# Columns that must exist on each table — (name, SQLite type + default).
# Only missing columns are added; existing data is never touched.
_WORKSPACE_COLS = [
    ("azure_tenant_id",       "TEXT DEFAULT ''"),
    ("azure_client_id",       "TEXT DEFAULT ''"),
    ("azure_client_secret",   "TEXT DEFAULT ''"),
    ("teams_chat_id",         "TEXT DEFAULT ''"),
    ("teams_agile_chat_id",   "TEXT DEFAULT ''"),
    ("teams_webhook_url",     "TEXT DEFAULT ''"),
    ("teams_subscription_id", "TEXT DEFAULT ''"),
    ("slack_bot_token",       "TEXT DEFAULT ''"),
    ("slack_signing_secret",  "TEXT DEFAULT ''"),
    ("slack_channel_id",      "TEXT DEFAULT ''"),
    ("slack_team_id",         "TEXT DEFAULT ''"),
]

_MEMBER_COLS = [
    ("platform_user_id", "TEXT"),
]


async def _add_missing_columns(conn, table: str, columns: list[tuple[str, str]]) -> None:
    result = await conn.execute(text(f"PRAGMA table_info({table})"))
    existing = {row[1] for row in result.fetchall()}
    for col_name, col_def in columns:
        if col_name not in existing:
            await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}"))


async def init_db() -> None:
    """Create all tables and add any missing columns (schema migration)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _add_missing_columns(conn, "workspaces", _WORKSPACE_COLS)
        await _add_missing_columns(conn, "members", _MEMBER_COLS)


async def get_db():
    """FastAPI dependency — yields an async DB session per request."""
    async with AsyncSessionLocal() as session:
        yield session
