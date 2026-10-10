"""The hourly crawl job: crawl every queued or due district in the crawls table, one at a time."""

from dataclasses import dataclass, replace
from datetime import timedelta

from ward_crawler.domain.city import CityWards
from ward_crawler.domain.crawl_row import (
    DONE,
    FAILED,
    NO_SOURCES,
    CrawlFinish,
    CrawlRow,
    SourceResult,
)
from ward_crawler.domain.errors import WardCrawlerError
from ward_crawler.domain.sources import CitySources
from ward_crawler.ports.clock import Clock
from ward_crawler.ports.crawl_ledger import CrawlLedger
from ward_crawler.ports.district_sources import DistrictSources
from ward_crawler.services.ward_crawl_service import WardCrawlService


@dataclass(frozen=True)
class CrawlPolicy:
    interval: timedelta = timedelta(days=30)
    retry: timedelta = timedelta(hours=6)
    stale_after: timedelta = timedelta(hours=3)
    expected_run: timedelta = timedelta(hours=1)
    wards_prefix: str = "crawl/wards/"


@dataclass(frozen=True)
class CrawlRun:
    district_id: str
    status: str
    detail: str


class CrawlJob:
    def __init__(
        self,
        ledger: CrawlLedger,
        districts: DistrictSources,
        service: WardCrawlService,
        policy: CrawlPolicy,
    ) -> None:
        self._ledger = ledger
        self._districts = districts
        self._service = service
        self._policy = policy

    def queue(self, district_id: str, clock: Clock) -> None:
        """A manual run: queue the district now, so this job's run picks it up."""
        now = clock.now()
        self._ledger.queue(district_id, now, now + self._policy.expected_run)

    def run(self, clock: Clock) -> tuple[CrawlRun, ...]:
        due = [
            row for row in self._ledger.rows() if row.is_due(clock.now(), self._policy.stale_after)
        ]
        return tuple(self._crawl(row, clock) for row in due)

    def _crawl(self, row: CrawlRow, clock: Clock) -> CrawlRun:
        city = self._districts.find(row.district_id)
        now = clock.now()
        if city is None:
            finish = CrawlFinish(NO_SOURCES, now, now + self._policy.interval)
            self._ledger.finish(row.district_id, finish)
            return CrawlRun(row.district_id, NO_SOURCES, "no file in sources/ for this district")
        if not self._ledger.claim(row, now, now + self._policy.expected_run):
            return CrawlRun(row.district_id, "skipped", "another run claimed it")
        return self._run_city(row.district_id, city, clock)

    def _run_city(self, district_id: str, city: CitySources, clock: Clock) -> CrawlRun:
        try:
            result = self._service.run(city)
        except WardCrawlerError as error:
            now = clock.now()
            retry = now + self._policy.retry
            failed = CrawlFinish(FAILED, now, retry, retry + self._policy.expected_run)
            self._ledger.finish(district_id, replace(failed, city=city.city, error=str(error)))
            return CrawlRun(district_id, FAILED, str(error))
        self._ledger.finish(district_id, self._done(result, clock))
        return CrawlRun(district_id, DONE, f"{len(result.records)} ward record(s)")

    def _done(self, result: CityWards, clock: Clock) -> CrawlFinish:
        now = clock.now()
        results = tuple(
            SourceResult(
                url=outcome.source.url,
                status=outcome.status,
                wards_found=outcome.wards_found,
                page_sha256=outcome.page.sha256 if outcome.page else None,
                fetched_at=outcome.page.fetched_at.isoformat() if outcome.page else None,
                detail=outcome.detail[:500],
            )
            for outcome in result.sources
        )
        key = f"{self._policy.wards_prefix}{result.city}.json"
        return CrawlFinish(
            DONE,
            now,
            now + self._policy.interval,
            None,
            result.city,
            len(result.records),
            key,
            results,
        )
