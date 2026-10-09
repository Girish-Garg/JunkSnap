"""Checks a model's JSON answer against the answer schema and turns it into domain values."""

import json
import re
from collections.abc import Callable
from typing import Any

from jsonschema import Draft202012Validator

from ward_crawler.adapters.answer_schema import ANSWER_SCHEMA
from ward_crawler.domain.errors import ExtractionError
from ward_crawler.domain.extraction import ExtractedWard
from ward_crawler.domain.values import CouncillorSeat, FactValue, OfficeContact, Population, Seat

# An office must name a post or a unit; anything else may be a person.
_DESIGNATION = re.compile(
    r"councillor|parshad|officer|inspector|commissioner|engineer|supervisor|office|department"
    r"|cell|zone|ward|health|sanitation|control room|helpline"
    r"|पार्षद|अधिकारी|निरीक्षक|आयुक्त|अभियंता|कार्यालय|विभाग|जोन|ज़ोन|वार्ड|स्वास्थ्य|सफाई",
    re.IGNORECASE,
)
# Text with an honorific is naming a person, so the fact is dropped.
_HONORIFIC = re.compile(
    r"\b(shri|shree|smt|shrimati|sushri|kumari|mr|mrs|ms|miss|dr)\b|श्री|श्रीमती|सुश्री|डॉ",
    re.IGNORECASE,
)


class AnswerParser:
    def __init__(self) -> None:
        self._validator = Draft202012Validator(ANSWER_SCHEMA)
        self._converters: dict[str, Callable[[Any], FactValue | None]] = {
            "ward_name": self._place,
            "zone": self._place,
            "area_km2": float,
            "population": self._population,
            "councillor_seat": self._councillor,
            "sanitation_office": self._office,
            "assembly_seat": self._seat,
            "lok_sabha_seat": self._seat,
        }

    def parse(self, text: str) -> tuple[ExtractedWard, ...]:
        """Raise ExtractionError when the answer is not JSON or breaks the schema."""
        answer = self._load(text)
        problems = [error.message for error in self._validator.iter_errors(answer)]
        if problems:
            raise ExtractionError("answer breaks the schema: " + "; ".join(problems[:3]))
        return tuple(self._ward(item) for item in answer["wards"])

    def _load(self, text: str) -> Any:
        start, end = text.find("{"), text.rfind("}")
        if start < 0 or end < start:
            raise ExtractionError("answer holds no JSON object")
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError as error:
            raise ExtractionError(f"answer is not valid JSON: {error}") from error

    def _ward(self, item: dict[str, Any]) -> ExtractedWard:
        facts: dict[str, FactValue] = {}
        for name, convert in self._converters.items():
            raw = item.get(name)
            value = None if raw is None else convert(raw)
            if value is not None:
                facts[name] = value
        return ExtractedWard(item["body"], item["ward_number"], item["evidence"], facts)

    def _text(self, raw: str) -> str | None:
        return " ".join(raw.split()) or None

    def _place(self, raw: str) -> str | None:
        place = self._text(raw)
        return None if place is None or _HONORIFIC.search(place) else place

    def _post(self, raw: str | None) -> str | None:
        post = self._text(raw or "")
        if post is None or _HONORIFIC.search(post) or not _DESIGNATION.search(post):
            return None
        return post

    def _population(self, raw: dict[str, int | None]) -> Population | None:
        count = raw["count"]
        return None if count is None else Population(count, raw["census_year"])

    def _councillor(self, raw: dict[str, str | None]) -> CouncillorSeat | None:
        office = self._post(raw["office"])
        if office is None:
            return None
        return CouncillorSeat(office, self._text(raw["reservation"] or ""))

    def _office(self, raw: dict[str, str | None]) -> OfficeContact | None:
        office = self._post(raw["office"])
        phone = self._text(raw["phone"] or "")
        email = self._text(raw["email"] or "")
        if office is None or not (phone or email):
            return None
        return OfficeContact(office, phone, email)

    def _seat(self, raw: dict[str, str | None]) -> Seat | None:
        name = self._text(raw["name"] or "")
        digits = "".join(str(int(char)) for char in raw["code"] or "" if char.isdecimal())
        return None if name is None else Seat(name, digits or None)
