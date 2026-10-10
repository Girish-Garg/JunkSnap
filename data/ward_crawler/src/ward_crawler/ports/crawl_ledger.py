from abc import ABC, abstractmethod
from datetime import datetime

from ward_crawler.domain.crawl_row import CrawlFinish, CrawlRow


class CrawlLedger(ABC):
    """The crawls table: one row per district."""

    @abstractmethod
    def rows(self) -> tuple[CrawlRow, ...]:
        """Every district row."""

    @abstractmethod
    def queue(self, district_id: str, now: datetime, expected_by: datetime) -> None:
        """Queue a district now (a manual run), unless it is running."""

    @abstractmethod
    def claim(self, row: CrawlRow, now: datetime, expected_by: datetime) -> bool:
        """Mark the row running if nobody changed its status since it was read."""

    @abstractmethod
    def finish(self, district_id: str, finish: CrawlFinish) -> None:
        """Write the outcome of a crawl."""
