"""Port for the current time, so tests can fix it."""

from abc import ABC, abstractmethod
from datetime import datetime


class Clock(ABC):
    """Tells the time in UTC."""

    @abstractmethod
    def now(self) -> datetime:
        """The current time, timezone-aware, in UTC."""
