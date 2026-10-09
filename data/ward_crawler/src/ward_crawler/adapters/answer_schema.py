"""The JSON Schema every model answer must match. The same schema goes to every model."""

from typing import Any

_TEXT: dict[str, Any] = {"type": ["string", "null"]}
_OBJECT_OR_NULL: dict[str, Any] = {"type": ["object", "null"], "additionalProperties": False}

_SEAT: dict[str, Any] = {
    **_OBJECT_OR_NULL,
    "required": ["name", "code"],
    "properties": {"name": {"type": "string"}, "code": _TEXT},
}

WARD_ANSWER: dict[str, Any] = {
    "type": "object",
    "required": ["body", "ward_number", "evidence"],
    "additionalProperties": False,
    "properties": {
        "body": {"type": "string"},
        "ward_number": {"type": "integer", "minimum": 1, "maximum": 999},
        "evidence": {"type": "string", "minLength": 3},
        "ward_name": _TEXT,
        "zone": _TEXT,
        "area_km2": {"type": ["number", "null"], "exclusiveMinimum": 0},
        "population": {
            **_OBJECT_OR_NULL,
            "required": ["count", "census_year"],
            "properties": {
                "count": {"type": "integer", "minimum": 0},
                "census_year": {"type": ["integer", "null"], "minimum": 1871, "maximum": 2100},
            },
        },
        "councillor_seat": {
            **_OBJECT_OR_NULL,
            "required": ["office", "reservation"],
            "properties": {"office": {"type": "string"}, "reservation": _TEXT},
        },
        "sanitation_office": {
            **_OBJECT_OR_NULL,
            "required": ["office", "phone", "email"],
            "properties": {"office": {"type": "string"}, "phone": _TEXT, "email": _TEXT},
        },
        "assembly_seat": _SEAT,
        "lok_sabha_seat": _SEAT,
    },
}

ANSWER_SCHEMA: dict[str, Any] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "required": ["wards"],
    "additionalProperties": False,
    "properties": {"wards": {"type": "array", "items": WARD_ANSWER}},
}
