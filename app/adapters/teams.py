"""
MS Teams platform adapter — per-workspace credentials.

Each TeamsAdapter instance owns a GraphAuth object with its own token cache,
so multiple Azure AD app registrations can coexist in one process.
"""

import logging
import os

import httpx

from app.adapters.base import PlatformAdapter
from app.config import settings, GRAPH_BASE_URL
from app.graph_auth import GraphAuth

logger = logging.getLogger(__name__)

_TOKEN_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "tokens")


class TeamsAdapter(PlatformAdapter):
    platform_name = "teams"

    def __init__(
        self,
        *,
        tenant_id: str,
        client_id: str,
        client_secret: str,
        agile_chat_id: str,
        workspace_id: int = 1,
    ):
        self.agile_chat_id = agile_chat_id
        self.workspace_id = workspace_id
        # Each workspace gets its own GraphAuth (own token cache + delegated token file)
        token_file = os.path.join(_TOKEN_DIR, f"delegated_token_{workspace_id}.json")
        os.makedirs(_TOKEN_DIR, exist_ok=True)
        self._auth = GraphAuth(
            tenant_id=tenant_id,
            client_id=client_id,
            client_secret=client_secret,
            token_file=token_file,
        )

    # ── Factory methods ──

    @classmethod
    def from_workspace(cls, ws) -> "TeamsAdapter":
        """Build an adapter from a Workspace ORM row."""
        return cls(
            tenant_id=ws.azure_tenant_id or settings.AZURE_TENANT_ID,
            client_id=ws.azure_client_id or settings.AZURE_CLIENT_ID,
            client_secret=ws.azure_client_secret or settings.AZURE_CLIENT_SECRET,
            agile_chat_id=ws.teams_agile_chat_id or ws.teams_chat_id or settings.AGILE_CHAT_ID,
            workspace_id=ws.id,
        )

    @classmethod
    def from_settings(cls) -> "TeamsAdapter":
        """Build an adapter from .env settings (default workspace / backward compat)."""
        return cls(
            tenant_id=settings.AZURE_TENANT_ID,
            client_id=settings.AZURE_CLIENT_ID,
            client_secret=settings.AZURE_CLIENT_SECRET,
            agile_chat_id=settings.AGILE_CHAT_ID,
            workspace_id=1,
        )

    # ── PlatformAdapter interface ──

    async def send_message(self, content: str, channel_id: str | None = None) -> None:
        """Send HTML content to a Teams group chat."""
        target = channel_id or self.agile_chat_id
        if not target:
            raise ValueError(f"No Teams chat ID for workspace {self.workspace_id}")

        url = f"{GRAPH_BASE_URL}/chats/{target}/messages"
        payload = {"body": {"contentType": "html", "content": content}}

        # Try delegated (user) token first — required for group chats
        user_headers = await self._auth.get_user_headers()
        if user_headers:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(url, headers=user_headers, json=payload)
                resp.raise_for_status()
                logger.info("Teams message sent via delegated token (ws=%d, chat=%s)", self.workspace_id, target)
                return

        logger.warning("No delegated token for ws=%d — falling back to app-only token", self.workspace_id)
        headers = await self._auth.get_headers()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            logger.info("Teams message sent via app token (ws=%d, chat=%s)", self.workspace_id, target)

    # ── Subscription helpers ──

    async def get_app_headers(self) -> dict:
        """Expose app-only headers for subscription management."""
        return await self._auth.get_headers()

    def get_login_url(self, redirect_uri: str) -> str:
        return self._auth.get_login_url(redirect_uri)

    async def exchange_code(self, code: str, redirect_uri: str) -> None:
        await self._auth.exchange_code(code, redirect_uri)

    @property
    def has_delegated_token(self) -> bool:
        return self._auth.has_user_token

    def client_state(self) -> str:
        """Unique clientState for this workspace's Graph subscription."""
        return f"agile-copilot-{self.workspace_id}"


# Default adapter (reads from .env) — used until workspaces are loaded from DB
_default_adapter: TeamsAdapter | None = None


def get_default_adapter() -> TeamsAdapter:
    global _default_adapter
    if _default_adapter is None:
        _default_adapter = TeamsAdapter.from_settings()
    return _default_adapter
