"""
Slack platform adapter — per-workspace credentials.

Receiving: POST /api/slack-webhook in main.py (Slack Events API).
Sending:   chat.postMessage via Slack Web API.
"""

import logging
import re

import httpx

from app.adapters.base import PlatformAdapter
from app.config import settings

logger = logging.getLogger(__name__)

SLACK_API = "https://slack.com/api"


def _html_to_mrkdwn(html: str) -> str:
    """Convert Teams-style HTML to Slack mrkdwn."""
    text = html
    text = re.sub(r"<b>(.*?)</b>", r"*\1*", text, flags=re.DOTALL)
    text = re.sub(r"<i>(.*?)</i>", r"_\1_", text, flags=re.DOTALL)
    text = re.sub(r"<br\s*/?>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("&bull;", "•").replace("&nbsp;", " ").replace("&amp;", "&")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


class SlackAdapter(PlatformAdapter):
    platform_name = "slack"

    def __init__(
        self,
        *,
        bot_token: str,
        signing_secret: str,
        channel_id: str,
        workspace_id: int | None = None,
    ):
        self.bot_token = bot_token
        self.signing_secret = signing_secret
        self.channel_id = channel_id
        self.workspace_id = workspace_id

    # ── Factory methods ──

    @classmethod
    def from_workspace(cls, ws) -> "SlackAdapter":
        return cls(
            bot_token=ws.slack_bot_token or settings.SLACK_BOT_TOKEN,
            signing_secret=ws.slack_signing_secret or settings.SLACK_SIGNING_SECRET,
            channel_id=ws.slack_channel_id or settings.SLACK_CHANNEL_ID,
            workspace_id=ws.id,
        )

    @classmethod
    def from_settings(cls) -> "SlackAdapter":
        return cls(
            bot_token=settings.SLACK_BOT_TOKEN,
            signing_secret=settings.SLACK_SIGNING_SECRET,
            channel_id=settings.SLACK_CHANNEL_ID,
        )

    # ── PlatformAdapter interface ──

    async def send_message(self, content: str, channel_id: str | None = None) -> None:
        target = channel_id or self.channel_id
        if not target:
            raise ValueError(f"No Slack channel ID for workspace {self.workspace_id}")
        if not self.bot_token:
            raise ValueError(f"No Slack bot token for workspace {self.workspace_id}")

        text = _html_to_mrkdwn(content)
        headers = {
            "Authorization": f"Bearer {self.bot_token}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{SLACK_API}/chat.postMessage",
                headers=headers,
                json={"channel": target, "text": text},
            )
            resp.raise_for_status()
            data = resp.json()
            if not data.get("ok"):
                raise ValueError(f"Slack API error: {data.get('error')}")
        logger.info("Slack message sent (ws=%s, channel=%s)", self.workspace_id, target)

    async def resolve_user_name(self, user_id: str) -> str:
        """Fetch a Slack user's display name from their user ID."""
        if not self.bot_token:
            return user_id
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{SLACK_API}/users.info",
                    headers={"Authorization": f"Bearer {self.bot_token}"},
                    params={"user": user_id},
                )
                data = resp.json()
                if data.get("ok"):
                    profile = data.get("user", {}).get("profile", {})
                    return profile.get("display_name") or profile.get("real_name") or user_id
        except Exception as e:
            logger.warning("Could not resolve Slack user %s: %s", user_id, e)
        return user_id

    def verify_signature(self, body_bytes: bytes, timestamp: str, signature: str) -> bool:
        """Verify the X-Slack-Signature header to prevent spoofing."""
        import hashlib
        import hmac
        if not self.signing_secret:
            return True  # skip verification if not configured
        base = f"v0:{timestamp}:{body_bytes.decode()}"
        expected = "v0=" + hmac.new(
            self.signing_secret.encode(), base.encode(), hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature)
