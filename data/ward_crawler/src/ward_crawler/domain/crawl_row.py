"""One district's row in the crawls table, and what a finished crawl writes back."""

from dataclasses import dataclass
from datetime import datetime, timedelta

QUEUED = "queued"
RUNNING = "running"
DONE = "done"
FAILED = "failed"
NO_SOURCES = "no_sources"
SETTLED = (DONE, FAILED, NO_SOURCES)


@dataclass(frozen=True)
class CrawlRow:
    """status None: the worker is still counting verified reports, so the district is not due."""

    district_id: str
    status: str | None
    next_due_at: datetime | None = None
    started_at: datetime | None = None

    def is_due(self, now: datetime, stale_after: timedelta) -> bool:
        if self.status == QUEUED:
            return True
        if self.status == RUNNING:
            # A crawl pod that died leaves the row running; retry it after a while.
            return self.started_at is None or now - self.started_at > stale_after
        if self.status in SETTLED:
            return self.next_due_at is not None and self.next_due_at <= now
        return False


@dataclass(frozen=True)
class SourceResult:
    url: str
    status: str
    wards_found: int
    page_sha256: str | None
    fetched_at: str | None
    detail: str


@dataclass(frozen=True)
class CrawlFinish:
    """status done, failed or no_sources; expected_by is set only for failed (the retry)."""

    status: str
    finished_at: datetime
    next_due_at: datetime
    expected_by: datetime | None = None
    city: str | None = None
    wards_found: int | None = None
    wards_key: str | None = None
    results: tuple[SourceResult, ...] = ()
    error: str | None = None
