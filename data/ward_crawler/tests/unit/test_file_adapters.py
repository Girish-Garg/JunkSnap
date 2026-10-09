import json
from datetime import UTC, datetime
from pathlib import Path

import pytest
from fakes import make_page

from ward_crawler.adapters.json_record_store import JsonRecordStore
from ward_crawler.adapters.page_cache import PageCache
from ward_crawler.adapters.source_catalog import JsonSourceCatalog
from ward_crawler.domain.city import CityWards
from ward_crawler.domain.errors import SourceListError, StoreError
from ward_crawler.domain.provenance import Sourced
from ward_crawler.domain.ward import ModelInfo, WardKey, WardRecord

SOURCES = Path(__file__).resolve().parents[2] / "sources"


def city_result() -> CityWards:
    provenance = make_page("https://lsg.rajasthan.gov.in/a.pdf", "Ward 1").provenance()
    facts = {"municipal_body": Sourced("Body", provenance), "ward_number": Sourced(1, provenance)}
    model = ModelInfo("amazon-bedrock", "m", "1")
    record = WardRecord(WardKey("jodhpur", "uttar", 1), "Rajasthan", facts, model)
    when = datetime(2026, 10, 10, tzinfo=UTC)
    return CityWards("jodhpur", "Rajasthan", when, (record,), (), (), "credit")


@pytest.mark.parametrize("city", ["jodhpur", "jaipur"])
def test_shipped_source_lists_load(city: str) -> None:
    sources = JsonSourceCatalog(SOURCES).load(city)

    assert sources.city == city
    assert sources.sources
    assert all(source.url.startswith("https://") for source in sources.sources)


def test_a_source_list_with_an_unknown_body_or_field_is_refused(tmp_path: Path) -> None:
    listing = json.loads((SOURCES / "jodhpur.json").read_text(encoding="utf-8"))
    listing["sources"][0]["body"] = "kota"
    listing["sources"][1]["fields"] = ["party"]
    (tmp_path / "bad.json").write_text(json.dumps(listing), encoding="utf-8")

    with pytest.raises(SourceListError, match="kota.*party"):
        JsonSourceCatalog(tmp_path).load("bad")


def test_store_writes_the_city_file_and_reads_back(tmp_path: Path) -> None:
    path = JsonRecordStore(tmp_path).save(city_result())

    saved = json.loads(Path(path).read_text(encoding="utf-8"))

    assert saved["records"][0]["id"] == "jodhpur-uttar-001"
    assert saved["review_status"] == "unreviewed"


def test_store_will_not_overwrite_reviewed_records(tmp_path: Path) -> None:
    path = Path(JsonRecordStore(tmp_path).save(city_result()))
    saved = json.loads(path.read_text(encoding="utf-8"))
    saved["records"][0]["review_status"] = "reviewed"
    path.write_text(json.dumps(saved), encoding="utf-8")

    with pytest.raises(StoreError):
        JsonRecordStore(tmp_path).save(city_result())
    JsonRecordStore(tmp_path, overwrite_reviewed=True).save(city_result())


def test_a_broken_cache_entry_is_a_miss(tmp_path: Path) -> None:
    cache = PageCache(tmp_path)
    page = make_page("https://x.gov.in/a", "Ward 1")
    cache.put(page)
    assert cache.get(page.url) == page

    for entry in tmp_path.glob("*.json"):
        entry.write_text("{half", encoding="utf-8")

    assert cache.get(page.url) is None
