"""The crawl job against an in-memory crawls table. No network."""

from datetime import UTC, datetime, timedelta
from pathlib import Path

from fakes import (
    SCHEMA,
    FakeMapLayerFinder,
    FakePageFetcher,
    FakeRecordExtractor,
    FakeRecordStore,
    make_city,
    make_page,
)

from ward_crawler.adapters.district_catalog import DistrictSourceCatalog, district_id
from ward_crawler.adapters.json_schema_validator import JsonSchemaRecordValidator
from ward_crawler.domain.crawl_row import (
    DONE,
    FAILED,
    NO_SOURCES,
    QUEUED,
    RUNNING,
    CrawlFinish,
    CrawlRow,
)
from ward_crawler.domain.errors import StoreError
from ward_crawler.domain.extraction import Extraction
from ward_crawler.domain.sources import CitySources, Source
from ward_crawler.domain.ward import ModelInfo
from ward_crawler.ports.clock import Clock
from ward_crawler.ports.crawl_ledger import CrawlLedger
from ward_crawler.ports.district_sources import DistrictSources
from ward_crawler.services.crawl_job import CrawlJob, CrawlPolicy
from ward_crawler.services.source_reader import ReadLimits, SourceReader
from ward_crawler.services.ward_crawl_service import WardCrawlService

NOW = datetime(2026, 10, 10, 9, 0, tzinfo=UTC)
URL = "https://lsg.rajasthan.gov.in/jodhpur-north.pdf"
PAGE = "Ward 1 1 9876"
SOURCES = Path(__file__).resolve().parents[2] / "sources"


class FixedClock(Clock):
    def now(self) -> datetime:
        return NOW


class FakeLedger(CrawlLedger):
    def __init__(self, *rows: CrawlRow) -> None:
        self.table = {row.district_id: row for row in rows}
        self.finished: dict[str, CrawlFinish] = {}
        self.lose_claims = False

    def rows(self) -> tuple[CrawlRow, ...]:
        return tuple(self.table.values())

    def queue(self, district_id: str, now: datetime, expected_by: datetime) -> None:
        self.table[district_id] = CrawlRow(district_id, QUEUED, now)

    def claim(self, row: CrawlRow, now: datetime, expected_by: datetime) -> bool:
        if self.lose_claims:
            return False
        self.table[row.district_id] = CrawlRow(row.district_id, RUNNING, None, now)
        return True

    def finish(self, district_id: str, finish: CrawlFinish) -> None:
        self.finished[district_id] = finish


class FakeDistricts(DistrictSources):
    def __init__(self, cities: dict[str, CitySources]) -> None:
        self._cities = cities

    def find(self, district_id: str) -> CitySources | None:
        return self._cities.get(district_id)


class BrokenStore(FakeRecordStore):
    def save(self, result: object) -> str:
        raise StoreError("bucket unreachable")


def job(ledger: FakeLedger, store: FakeRecordStore | None = None) -> CrawlJob:
    extractor = FakeRecordExtractor(lambda _r: Extraction((), ModelInfo("bedrock", "m", "v")))
    reader = SourceReader(
        FakePageFetcher({URL: make_page(URL, PAGE)}), extractor, ReadLimits()
    )
    service = WardCrawlService(
        reader, FakeMapLayerFinder(), JsonSchemaRecordValidator(SCHEMA), store or FakeRecordStore()
    )
    city = make_city(Source(URL, "ward list", "jodhpur-uttar-mc"))
    return CrawlJob(ledger, FakeDistricts({"rajasthan-jodhpur": city}), service, CrawlPolicy())


def test_a_queued_district_is_crawled_and_due_again_after_the_interval() -> None:
    ledger = FakeLedger(CrawlRow("rajasthan-jodhpur", QUEUED, NOW))

    (run,) = job(ledger).run(FixedClock())

    finish = ledger.finished["rajasthan-jodhpur"]
    assert run.status == DONE
    assert (finish.status, finish.city) == (DONE, "jodhpur")
    assert finish.wards_key == "crawl/wards/jodhpur.json"
    assert finish.next_due_at == NOW + timedelta(days=30)
    assert finish.expected_by is None
    assert finish.results[0].url == URL
    assert finish.results[0].page_sha256 == make_page(URL, PAGE).sha256


def test_a_district_without_a_source_file_is_marked_no_sources() -> None:
    ledger = FakeLedger(CrawlRow("rajasthan-kota", QUEUED, NOW))

    (run,) = job(ledger).run(FixedClock())

    assert run.status == NO_SOURCES
    assert ledger.finished["rajasthan-kota"].status == NO_SOURCES


def test_a_failed_crawl_is_retried_later_and_says_when_data_is_expected() -> None:
    ledger = FakeLedger(CrawlRow("rajasthan-jodhpur", QUEUED, NOW))

    (run,) = job(ledger, BrokenStore()).run(FixedClock())

    finish = ledger.finished["rajasthan-jodhpur"]
    assert run.status == FAILED
    assert finish.error == "bucket unreachable"
    assert finish.next_due_at == NOW + timedelta(hours=6)
    assert finish.expected_by == NOW + timedelta(hours=7)


def test_only_due_rows_run_and_a_lost_claim_is_skipped() -> None:
    later = NOW + timedelta(days=1)
    ledger = FakeLedger(
        CrawlRow("rajasthan-jodhpur", QUEUED, NOW),
        CrawlRow("rajasthan-jaipur", DONE, later),
        CrawlRow("rajasthan-ajmer", None),
    )
    ledger.lose_claims = True

    runs = job(ledger).run(FixedClock())

    assert [(run.district_id, run.status) for run in runs] == [("rajasthan-jodhpur", "skipped")]
    assert ledger.finished == {}


def test_due_rules_cover_stale_runs_and_settled_rows() -> None:
    stale = timedelta(hours=3)
    assert CrawlRow("d", RUNNING, None, NOW - timedelta(hours=4)).is_due(NOW, stale)
    assert not CrawlRow("d", RUNNING, None, NOW - timedelta(hours=1)).is_due(NOW, stale)
    assert CrawlRow("d", FAILED, NOW).is_due(NOW, stale)
    assert not CrawlRow("d", NO_SOURCES, NOW + timedelta(days=1)).is_due(NOW, stale)
    assert not CrawlRow("d", None).is_due(NOW, stale)


def test_a_manual_run_queues_the_district_first() -> None:
    ledger = FakeLedger()
    subject = job(ledger)

    subject.queue("rajasthan-jodhpur", FixedClock())
    (run,) = subject.run(FixedClock())

    assert run.status == DONE


def test_district_ids_follow_the_server_rule_and_find_the_source_files() -> None:
    assert district_id("Rajasthan", "jodhpur") == "rajasthan-jodhpur"
    assert district_id("Tamil Nadu", "Tiruchirāppalli") == "tamil-nadu-tiruchirappalli"
    catalog = DistrictSourceCatalog(SOURCES)
    found = catalog.find("rajasthan-jodhpur")
    assert found is not None and found.city == "jodhpur"
    assert catalog.find("rajasthan-kota") is None
