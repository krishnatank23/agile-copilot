"""
Database setup — SQLite via SQLAlchemy async.
Replaces the Microsoft Graph / Excel storage layer.
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.db.models import Base

DATABASE_URL = "sqlite+aiosqlite:///./agile_copilot.db"

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db() -> None:
    """Create all tables on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    """FastAPI dependency — yields an async DB session per request."""
    async with AsyncSessionLocal() as session:
        yield session
