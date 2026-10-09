"""Clock over the system time."""

from datetime import UTC, datetime

from ml.ports.clock import Clock


class SystemClock(Clock):
    def now(self) -> datetime:
        return datetime.now(UTC)
