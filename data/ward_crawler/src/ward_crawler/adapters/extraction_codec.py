"""The JSON form of a model extraction, for the extraction cache."""

from dataclasses import asdict, is_dataclass
from typing import Any

from ward_crawler.domain.extraction import ExtractedWard, Extraction
from ward_crawler.domain.values import CouncillorSeat, FactValue, OfficeContact, Population, Seat
from ward_crawler.domain.ward import ModelInfo

# Facts held as small value objects; every other fact is a plain string or number.
_VALUE_TYPES: dict[str, type[Population | Seat | CouncillorSeat | OfficeContact]] = {
    "population": Population,
    "assembly_seat": Seat,
    "lok_sabha_seat": Seat,
    "councillor_seat": CouncillorSeat,
    "sanitation_office": OfficeContact,
}


class ExtractionCodec:
    def to_json(self, extraction: Extraction) -> dict[str, object]:
        return {
            "model": asdict(extraction.model),
            "wards": [self._ward(ward) for ward in extraction.wards],
        }

    def from_json(self, saved: Any) -> Extraction:
        """Raise KeyError, TypeError or ValueError for an entry that is not an extraction."""
        wards = tuple(self._read_ward(item) for item in saved["wards"])
        return Extraction(wards, ModelInfo(**saved["model"]))

    def _ward(self, ward: ExtractedWard) -> dict[str, object]:
        facts = {name: self._fact(value) for name, value in ward.facts.items()}
        number, evidence = ward.ward_number, ward.evidence
        return {"body": ward.body, "ward_number": number, "evidence": evidence, "facts": facts}

    def _fact(self, value: FactValue) -> object:
        return asdict(value) if is_dataclass(value) and not isinstance(value, type) else value

    def _read_ward(self, item: Any) -> ExtractedWard:
        facts = {name: self._read_fact(name, raw) for name, raw in item["facts"].items()}
        return ExtractedWard(item["body"], int(item["ward_number"]), item["evidence"], facts)

    def _read_fact(self, name: str, raw: Any) -> FactValue:
        kind = _VALUE_TYPES.get(name)
        if kind is None:
            if not isinstance(raw, str | int | float):
                raise TypeError(f"fact {name} is not a plain value")
            return raw
        return kind(**raw)
