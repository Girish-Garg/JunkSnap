"""Port for the current time, so tests can fix it."""

from abc import ABC, abstractmethod
from datetime import datetime


class Clock(ABC):
    @abstractmethod
    def now(self) -> datetime:
        """Timezone-aware, in UTC."""
