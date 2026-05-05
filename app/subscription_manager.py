"""
Graph API subscription manager — creates and renews subscriptions
to listen for new messages in an MS Teams channel.

Includes auto-renewal: a background asyncio task that renews the
subscription every ~50 minutes so it never expires.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

import httpx

from app.config import settings, GRAPH_BASE_URL, build_graph_notification_url
from app.graph_auth import graph_auth

logger = logging.getLogger(__name__)

# Subscription max lifetime for chat messages is 60 minutes (Graph limit)
SUBSCRIPTION_LIFETIME_MINUTES = 55  # keep under the 60-min Graph hard limit
RENEWAL_INTERVAL_SECONDS = 45 * 60  # renew every 45 min (well before 55-min expiry)
EXPIRY_BUFFER_SECONDS = 5 * 60      # treat as expired if < 5 min remaining


class SubscriptionManager:
    """
    Manages Microsoft Graph API subscriptions for Teams chat messages.
    Handles creation, adoption, renewal, and deletion.
    """

    def __init__(self):
        self._subscription_id: str | None = None
        self._expires_at: datetime | None = None
        self._renewal_task: asyncio.Task | None = None

    @property
    def is_active(self) -> bool:
        if not self._subscription_id or not self._expires_at:
            return False
        # Active = not expired AND has more than buffer time remaining
        return datetime.now(timezone.utc) < (self._expires_at - timedelta(seconds=EXPIRY_BUFFER_SECONDS))

    def _seconds_until_expiry(self) -> float:
        if not self._expires_at:
            return 0
        return (self._expires_at - datetime.now(timezone.utc)).total_seconds()

    async def create_subscription(self) -> dict:
        """
        Create a new subscription to listen for messages in the configured
        Teams chat. The Graph API will POST notifications to our webhook.
        """
        headers = await graph_auth.get_headers()

        expiration = datetime.now(timezone.utc) + timedelta(minutes=SUBSCRIPTION_LIFETIME_MINUTES)
        notification_url = build_graph_notification_url(settings.WEBHOOK_NOTIFICATION_URL)
        if not notification_url:
            raise ValueError("WEBHOOK_NOTIFICATION_URL is not configured")

        payload = {
            "changeType": "created",
            "notificationUrl": notification_url,
            "resource": f"/chats/{settings.AGILE_CHAT_ID}/messages",
            "expirationDateTime": expiration.isoformat(),
            "clientState": "agile-copilot-secret",
        }

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{GRAPH_BASE_URL}/subscriptions",
                headers=headers,
                json=payload,
            )
            if not response.is_success:
                logger.error("Subscription creation error: %s", response.text)
            response.raise_for_status()
            data = response.json()

        self._subscription_id = data["id"]
        self._expires_at = datetime.fromisoformat(
            data["expirationDateTime"].replace("Z", "+00:00")
        )

        logger.info(
            "Subscription created: %s (expires %s, %.0f min remaining)",
            self._subscription_id,
            self._expires_at.isoformat(),
            self._seconds_until_expiry() / 60,
        )
        return data

    async def renew_subscription(self) -> dict:
        """Renew the current subscription to extend its lifetime."""
        if not self._subscription_id:
            logger.warning("No subscription ID to renew — creating new one")
            return await self.create_subscription()

        headers = await graph_auth.get_headers()
        expiration = datetime.now(timezone.utc) + timedelta(minutes=SUBSCRIPTION_LIFETIME_MINUTES)

        payload = {"expirationDateTime": expiration.isoformat()}

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.patch(
                f"{GRAPH_BASE_URL}/subscriptions/{self._subscription_id}",
                headers=headers,
                json=payload,
            )
            if not response.is_success:
                logger.warning(
                    "Renewal PATCH failed (%s): %s — will create new subscription",
                    response.status_code, response.text,
                )
                # If renewing a stale/expired sub fails, create a fresh one
                self._subscription_id = None
                self._expires_at = None
                return await self.create_subscription()

            data = response.json()

        self._expires_at = datetime.fromisoformat(
            data["expirationDateTime"].replace("Z", "+00:00")
        )

        logger.info(
            "Subscription renewed: %s (new expiry %s, %.0f min remaining)",
            self._subscription_id,
            self._expires_at.isoformat(),
            self._seconds_until_expiry() / 60,
        )
        return data

    async def delete_subscription(self) -> bool:
        """Delete the current subscription."""
        if not self._subscription_id:
            return True

        headers = await graph_auth.get_headers()

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.delete(
                f"{GRAPH_BASE_URL}/subscriptions/{self._subscription_id}",
                headers=headers,
            )

        if response.status_code in (204, 404):
            logger.info("Subscription deleted: %s", self._subscription_id)
            self._subscription_id = None
            self._expires_at = None
            return True

        logger.error("Failed to delete subscription: HTTP %s", response.status_code)
        return False

    async def list_subscriptions(self) -> list:
        """Return list of current subscriptions for this app/tenant."""
        headers = await graph_auth.get_headers()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"{GRAPH_BASE_URL}/subscriptions", headers=headers)
            resp.raise_for_status()
            data = resp.json()
        return data.get("value", [])

    async def find_existing_subscription(self, resource: str) -> dict | None:
        """Find a non-expired subscription for the given resource.

        Returns the subscription dict if found and still valid, otherwise None.
        """
        try:
            subs = await self.list_subscriptions()
        except Exception as e:
            logger.warning("Could not list subscriptions: %s", e)
            return None

        now = datetime.now(timezone.utc)
        for s in subs:
            if s.get("resource") != resource:
                continue
            # Parse expiry and skip already-expired subscriptions
            try:
                exp = datetime.fromisoformat(
                    s.get("expirationDateTime", "").replace("Z", "+00:00")
                )
            except ValueError:
                continue
            if now >= exp:
                logger.info(
                    "Found expired subscription %s (expired %s) — will not adopt",
                    s.get("id"), exp.isoformat(),
                )
                continue
            return s

        return None

    async def ensure_active(self) -> dict:
        """Create or renew subscription so it's active with plenty of time remaining."""
        # Already tracking a valid subscription with > buffer time left
        if self.is_active:
            logger.info(
                "Subscription %s still active (%.0f min remaining)",
                self._subscription_id,
                self._seconds_until_expiry() / 60,
            )
            return {"status": "active", "id": self._subscription_id}

        # Check Graph for any existing non-expired subscription we can adopt
        target_resource = f"/chats/{settings.AGILE_CHAT_ID}/messages"
        existing = await self.find_existing_subscription(target_resource)

        if existing:
            self._subscription_id = existing["id"]
            self._expires_at = datetime.fromisoformat(
                existing["expirationDateTime"].replace("Z", "+00:00")
            )
            minutes_left = self._seconds_until_expiry() / 60
            logger.info(
                "Adopted existing subscription %s (%.0f min remaining)",
                self._subscription_id, minutes_left,
            )
            # Renew immediately if less than 10 minutes remain
            if minutes_left < 10:
                logger.info("Subscription near expiry — renewing immediately")
                return await self.renew_subscription()
            return {"status": "adopted", "id": self._subscription_id}

        # No valid subscription found — create a fresh one
        logger.info("No valid subscription found — creating new one")
        return await self.create_subscription()

    def start_auto_renewal(self) -> None:
        """Start the background auto-renewal loop."""
        if self._renewal_task and not self._renewal_task.done():
            return  # already running
        self._renewal_task = asyncio.create_task(self._auto_renewal_loop())
        logger.info(
            "Subscription auto-renewal started (interval: %d min)",
            RENEWAL_INTERVAL_SECONDS // 60,
        )

    def stop_auto_renewal(self) -> None:
        """Stop the background auto-renewal loop."""
        if self._renewal_task and not self._renewal_task.done():
            self._renewal_task.cancel()
            logger.info("Subscription auto-renewal stopped")

    async def _auto_renewal_loop(self) -> None:
        """
        Background loop that renews the subscription on a fixed interval.

        FIX: Sleeps for the REMAINING time until renewal is due (based on
        actual expiry), not a fixed 50-min offset from loop start. This
        prevents the bug where a near-expired adopted subscription isn't
        renewed until 50 min later.
        """
        while True:
            try:
                # Calculate sleep duration based on actual expiry time
                seconds_left = self._seconds_until_expiry()
                # Renew when RENEWAL_INTERVAL_SECONDS before expiry
                sleep_for = max(
                    seconds_left - (SUBSCRIPTION_LIFETIME_MINUTES * 60 - RENEWAL_INTERVAL_SECONDS),
                    60,  # never sleep less than 1 minute
                )
                logger.info(
                    "Auto-renewal: sleeping %.0f min until next renewal",
                    sleep_for / 60,
                )
                await asyncio.sleep(sleep_for)

                logger.info("Auto-renewal: renewing subscription now...")
                await self.renew_subscription()
                logger.info(
                    "Auto-renewal: done (next expiry in %.0f min)",
                    self._seconds_until_expiry() / 60,
                )

            except asyncio.CancelledError:
                logger.info("Auto-renewal loop cancelled")
                break
            except Exception as e:
                logger.error("Auto-renewal failed: %s — retrying in 5 min", e)
                try:
                    await asyncio.sleep(300)
                except asyncio.CancelledError:
                    break


# Module-level singleton
subscription_manager = SubscriptionManager()