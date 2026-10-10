"""The crawl output guard: never replace a good file with an empty or smaller one. No AWS."""

from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path

import pytest
from fakes import make_page

from ward_crawler.adapters.blob_record_store import BlobRecordStore
from ward_crawler.adapters.guarded_record_store import GuardedRecordStore
from ward_crawler.adapters.json_blobs import JsonBlobs
from ward_crawler.adapters.local_blob_store import LocalBlobStore
from ward_crawler.domain.city import CityWards, SourceOutcome
from ward_crawler.domain.errors import StoreError
from ward_crawler.domain.layers import FeatureLayer, MapFeature
from ward_crawler.domain.provenance import Sourced
from ward_crawler.domain.sources import Source
from ward_crawler.domain.ward import ModelInfo, WardKey, WardRecord

URL = "https://lsg.rajasthan.gov.in/a.pdf"
PAGE = make_page(URL, "Ward 1 Ward 2")
FETCHED = SourceOutcome(Source(URL, "ward list", "uttar"), "fetched", "ok", PAGE, 2)
SCHOOL = FeatureLayer("school", PAGE.provenance(), (MapFeature("osm:node/1", ((26.2, 73.0),)),))


def record(number: int) -> WardRecord:
    facts = {
        "municipal_body": Sourced("Body", PAGE.provenance()),
        "ward_number": Sourced(number, PAGE.provenance()),
    }
    return WardRecord(
        WardKey("jodhpur", "uttar", number), "Rajasthan", facts, ModelInfo("b", "m", "1")
    )


def result(wards: int, layers: tuple[FeatureLayer, ...] = (SCHOOL,)) -> CityWards:
    records = tuple(record(number) for number in range(1, wards + 1))
    when = datetime(2026, 10, 10, tzinfo=UTC)
    return CityWards("jodhpur", "Rajasthan", when, records, layers, (FETCHED,), "credit")


def store(tmp_path: Path) -> GuardedRecordStore:
    blobs = JsonBlobs(LocalBlobStore(tmp_path))
    return GuardedRecordStore(BlobRecordStore(blobs), blobs)


def test_a_first_crawl_and_an_equal_or_larger_one_are_saved(tmp_path: Path) -> None:
    store(tmp_path).save(result(2))
    store(tmp_path).save(result(3))

    assert (tmp_path / "wards" / "jodhpur.json").exists()


def test_a_crawl_with_no_fetched_page_is_refused(tmp_path: Path) -> None:
    unreachable = replace(FETCHED, status="unreachable", page=None, wards_found=0)

    with pytest.raises(StoreError, match="no official page"):
        store(tmp_path).save(replace(result(2), sources=(unreachable,)))
    assert not (tmp_path / "wards").exists()


def test_fewer_wards_than_the_stored_file_are_refused(tmp_path: Path) -> None:
    store(tmp_path).save(result(3))

    with pytest.raises(StoreError, match="fewer than the 3"):
        store(tmp_path).save(result(0))


def test_a_missing_map_layer_is_refused(tmp_path: Path) -> None:
    store(tmp_path).save(result(2))

    with pytest.raises(StoreError, match="school"):
        store(tmp_path).save(result(2, layers=()))
