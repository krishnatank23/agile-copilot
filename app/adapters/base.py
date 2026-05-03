"""Abstract platform adapter — implemented by Teams and Slack adapters."""

from abc import ABC, abstractmethod


class PlatformAdapter(ABC):
    @property
    @abstractmethod
    def platform_name(self) -> str: ...

    @abstractmethod
    async def send_message(self, content: str, channel_id: str | None = None) -> None:
        """Send a message (HTML for Teams, plain/mrkdwn for Slack) to the given channel."""
        ...
