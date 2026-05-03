"""
SQLAlchemy ORM models.

Workspace → Members → Tasks / BacklogItems

Each Workspace stores its own platform credentials so multiple Teams/Slack
workspaces can be connected without touching .env.
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime,
    ForeignKey, Text, UniqueConstraint,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Workspace(Base):
    """
    An org / integration instance (Teams workspace or Slack workspace).
    Credentials are stored per-workspace so multiple orgs can connect.
    """
    __tablename__ = "workspaces"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, default="Default")
    platform = Column(String, nullable=False, default="teams")  # "teams" | "slack" | "both"
    created_at = Column(DateTime, default=datetime.utcnow)

    # ── Teams credentials ──
    azure_tenant_id = Column(String, default="")
    azure_client_id = Column(String, default="")
    azure_client_secret = Column(String, default="")   # stored encrypted in production
    teams_chat_id = Column(String, default="")          # monitored EOD chat
    teams_agile_chat_id = Column(String, default="")    # where summaries are sent
    teams_webhook_url = Column(String, default="")      # public URL for Graph subscription
    teams_subscription_id = Column(String, default="")  # active Graph subscription ID

    # ── Slack credentials ──
    slack_bot_token = Column(String, default="")        # xoxb-...
    slack_signing_secret = Column(String, default="")
    slack_channel_id = Column(String, default="")       # where summaries are sent
    slack_team_id = Column(String, default="")          # Slack workspace ID (for webhook routing)

    members = relationship("Member", back_populates="workspace", cascade="all, delete-orphan")


class Member(Base):
    """A team member identified by display name."""
    __tablename__ = "members"
    __table_args__ = (UniqueConstraint("workspace_id", "display_name"),)

    id = Column(Integer, primary_key=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False, default=1)
    display_name = Column(String, nullable=False)
    platform_user_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="members")
    tasks = relationship("Task", back_populates="member", cascade="all, delete-orphan")
    backlog_items = relationship("BacklogItem", back_populates="member", cascade="all, delete-orphan")


class Task(Base):
    """A parsed agile task."""
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    backlog_item_id = Column(Integer, ForeignKey("backlog_items.id"), nullable=True)

    brand = Column(String, default="")
    activity_type = Column(String, default="")
    backlog = Column(String, default="")
    sprint_backlog = Column(String, nullable=False)
    dependency = Column(String, default="")
    deadline = Column(String, default="")
    priority = Column(String, default="Medium")
    stage = Column(String, default="WIP")
    comments = Column(Text, default="")
    expected_story_points = Column(Integer, default=2)
    actual_story_points = Column(Integer, default=0)
    sprint_end_date = Column(String, default="")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    member = relationship("Member", back_populates="tasks")


class BacklogItem(Base):
    """A backlog item — can be promoted into a sprint task."""
    __tablename__ = "backlog_items"

    id = Column(Integer, primary_key=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    text = Column(String, nullable=False)
    promoted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    member = relationship("Member", back_populates="backlog_items")
