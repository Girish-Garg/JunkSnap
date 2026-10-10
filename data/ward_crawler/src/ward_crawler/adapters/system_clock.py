from datetime import UTC, datetime

from ward_crawler.ports.clock import Clock


class SystemClock(Clock):
    def now(self) -> datetime:
        return datetime.now(UTC)
