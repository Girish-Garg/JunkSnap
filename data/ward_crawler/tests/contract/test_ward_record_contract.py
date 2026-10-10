import json
from pathlib import Path

import pytest

from ward_crawler.adapters.json_schema_validator import JsonSchemaRecordValidator
from ward_crawler.domain.errors import InvalidRecordError

CONTRACTS = Path(__file__).resolve().parents[4] / "contracts"
SCHEMA = CONTRACTS / "schemas" / "ward_record.schema.json"


@pytest.mark.parametrize("fixture", sorted((CONTRACTS / "fixtures").glob("ward_record.*.json")))
def test_fixture_matches_the_contract(fixture: Path) -> None:
    JsonSchemaRecordValidator(SCHEMA).check_json(json.loads(fixture.read_text(encoding="utf-8")))


def test_contract_has_no_room_for_a_name_or_party() -> None:
    fixture = CONTRACTS / "fixtures" / "ward_record.jdh-1.json"
    record = json.loads(fixture.read_text(encoding="utf-8"))

    for extra in ("councillor_name", "party"):
        with pytest.raises(InvalidRecordError):
            JsonSchemaRecordValidator(SCHEMA).check_json({**record, extra: "x"})
