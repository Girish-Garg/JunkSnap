"""Turns an extraction into ward records that carry the page's provenance."""

from ward_crawler.domain.extraction import ExtractedWard, Extraction
from ward_crawler.domain.provenance import Sourced
from ward_crawler.domain.sources import CitySources, Page, Source
from ward_crawler.domain.utils import has_honorific, looks_garbled, ward_window
from ward_crawler.domain.values import FactValue
from ward_crawler.domain.ward import ModelInfo, WardKey, WardRecord
from ward_crawler.services.fact_check import FactCheck

# These must sit in the ward's own row, between its number and the next row's number.
WINDOW_FIELDS = ("population", "zone", "ward_name")


class RecordBuilder:
    """Builds records for one page; anything the page does not show is dropped, not guessed."""

    def __init__(self, city: CitySources, page: Page, source: Source) -> None:
        self._city = city
        self._page = page
        self._source = source
        self._check = FactCheck(page)

    def build(self, extraction: Extraction) -> tuple[WardRecord, ...]:
        records = (self._record(ward, extraction.model) for ward in extraction.wards)
        return tuple(record for record in records if record is not None)

    def _record(self, ward: ExtractedWard, model: ModelInfo) -> WardRecord | None:
        body = self._city.body(self._source.body or ward.body)
        window = ward_window(ward.evidence, ward.ward_number)
        if body is None or not window or not self._page.supports(ward.evidence):
            return None
        provenance = self._page.provenance()
        facts: dict[str, Sourced] = {}
        for name, value in ward.facts.items():
            kept = self._kept(name, value, window)
            if kept is not None:
                facts[name] = Sourced(kept, provenance)
        facts["municipal_body"] = Sourced(body.name, provenance)
        facts["ward_number"] = Sourced(ward.ward_number, provenance)
        key = WardKey(self._city.city, body.slug, ward.ward_number)
        return WardRecord(key, self._city.state, facts, model)

    def _kept(self, name: str, value: FactValue, window: str) -> FactValue | None:
        if self._source.fields and name not in self._source.fields:
            return None
        if not self._check.holds(value, window if name in WINDOW_FIELDS else None):
            return None
        if not isinstance(value, str):
            return value
        # Garbled PDF text passes only through a hand-checked alias; places never name a person.
        clean = self._city.aliases.get(value, value)
        return None if looks_garbled(clean) or has_honorific(clean) else clean
