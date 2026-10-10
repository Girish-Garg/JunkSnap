"""Checks ward records against contracts/schemas/ward_record.schema.json."""

import json
from pathlib import Path

from jsonschema import Draft202012Validator

from ward_crawler.domain.errors import InvalidRecordError
from ward_crawler.domain.ward import WardRecord
from ward_crawler.ports.record_validator import RecordValidator


class JsonSchemaRecordValidator(RecordValidator):
    def __init__(self, schema_path: Path) -> None:
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
        Draft202012Validator.check_schema(schema)
        self._validator = Draft202012Validator(schema)

    def check(self, record: WardRecord) -> None:
        self.check_json(record.to_json())

    def check_json(self, instance: object) -> None:
        problems = [
            f"{'/'.join(str(part) for part in error.absolute_path) or '(root)'}: {error.message}"
            for error in self._validator.iter_errors(instance)
        ]
        if problems:
            raise InvalidRecordError("; ".join(problems[:3]))
