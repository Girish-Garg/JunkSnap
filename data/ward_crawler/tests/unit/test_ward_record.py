from datetime import UTC, datetime

import pytest
from fakes import SCHEMA

from ward_crawler.adapters.json_schema_validator import JsonSchemaRecordValidator
from ward_crawler.domain.errors import InvalidRecordError, UnsourcedFieldError
from ward_crawler.domain.provenance import Provenance, Sourced
from ward_crawler.domain.ward import ModelInfo, WardKey, WardRecord
from ward_crawler.domain.ward_book import WardBook

SHA_A = "a" * 64
SHA_B = "b" * 64
MODEL_A = ModelInfo("bedrock", "model-a", "1")
MODEL_B = ModelInfo("bedrock", "model-b", "2")
KEY = WardKey("jodhpur", "uttar", 12)


def at(hour: int, sha: str = SHA_A, url: str = "https://lsg.rajasthan.gov.in/a") -> Provenance:
    return Provenance(url, datetime(2026, 10, 10, hour, tzinfo=UTC), sha)


def record(model: ModelInfo = MODEL_A, **facts: Sourced) -> WardRecord:
    identity = {
        "municipal_body": Sourced("Nagar Nigam Jodhpur Uttar", at(9)),
        "ward_number": Sourced(12, at(9)),
    }
    return WardRecord(KEY, "Rajasthan", {**identity, **facts}, model)


@pytest.mark.parametrize(
    ("url", "fetched_at", "sha"),
    [
        ("", datetime(2026, 10, 10, tzinfo=UTC), SHA_A),
        ("not-a-url", datetime(2026, 10, 10, tzinfo=UTC), SHA_A),
        ("https://x.gov.in", datetime(2026, 10, 10), SHA_A),
        ("https://x.gov.in", datetime(2026, 10, 10, tzinfo=UTC), "abc"),
    ],
)
def test_a_fact_without_a_full_source_is_rejected(url: str, fetched_at: datetime, sha: str) -> None:
    with pytest.raises(UnsourcedFieldError):
        Provenance(url, fetched_at, sha)


def test_the_contract_rejects_a_field_that_lost_its_source() -> None:
    validator = JsonSchemaRecordValidator(SCHEMA)
    good = record(zone=Sourced("North", at(10))).to_json()
    validator.check_json(good)

    unsourced = {**good, "zone": {"value": "North"}}

    with pytest.raises(InvalidRecordError, match="zone"):
        validator.check_json(unsourced)


def test_the_contract_rejects_a_person_like_extra_field() -> None:
    validator = JsonSchemaRecordValidator(SCHEMA)
    with_name = {**record().to_json(), "councillor_name": "anyone"}

    with pytest.raises(InvalidRecordError, match="councillor_name"):
        validator.check_json(with_name)


def test_merge_keeps_the_newest_fetched_value_per_field() -> None:
    older = record(MODEL_A, zone=Sourced("Old zone", at(9)), ward_name=Sourced("Paota", at(9)))
    newer = record(MODEL_B, zone=Sourced("New zone", at(11, SHA_B)))

    merged = older.merged_with(newer)
    merged_reverse = newer.merged_with(older)

    for result in (merged, merged_reverse):
        assert result.facts["zone"].value == "New zone"
        assert result.facts["zone"].provenance.page_sha256 == SHA_B
        assert result.facts["ward_name"].value == "Paota"
    assert merged.extracted_by == MODEL_B
    assert merged_reverse.extracted_by == MODEL_B


def test_ward_book_merges_records_for_the_same_ward_and_sorts_by_id() -> None:
    book = WardBook()
    other_ward = WardRecord(
        WardKey("jodhpur", "dakshin", 3),
        "Rajasthan",
        {
            "municipal_body": Sourced("Nagar Nigam Jodhpur Dakshin", at(9)),
            "ward_number": Sourced(3, at(9)),
        },
        MODEL_A,
    )
    book.add(record(zone=Sourced("Old zone", at(9))))
    book.add(other_ward)
    book.add(record(zone=Sourced("New zone", at(12))))

    records = book.records()

    assert [item.key.id for item in records] == ["dakshin-w3", "uttar-w12"]
    assert records[1].facts["zone"].value == "New zone"


def test_a_record_cannot_carry_unknown_fields() -> None:
    with pytest.raises(InvalidRecordError):
        record(party=Sourced("anything", at(9)))


def test_a_record_needs_a_sourced_body_and_ward_number() -> None:
    with pytest.raises(InvalidRecordError, match="body and ward number"):
        WardRecord(KEY, "Rajasthan", {"zone": Sourced("North", at(9))}, MODEL_A)
