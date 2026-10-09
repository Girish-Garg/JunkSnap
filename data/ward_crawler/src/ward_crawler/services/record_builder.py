"""Turns a model's extraction into ward records that carry the page's provenance."""

from ward_crawler.domain.extraction import ExtractedWard, Extraction
from ward_crawler.domain.provenance import Sourced
from ward_crawler.domain.sources import CitySources, Page, Source
from ward_crawler.domain.utils import digit_runs
from ward_crawler.domain.values import FactValue, Population
from ward_crawler.domain.ward import ModelInfo, WardKey, WardRecord
from ward_crawler.services.fact_check import FactCheck


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
        shown = str(ward.ward_number) in digit_runs(ward.evidence)
        if body is None or not shown or not self._page.supports(ward.evidence):
            return None
        provenance = self._page.provenance()
        facts = {
            name: Sourced(value, provenance)
            for name, value in ward.facts.items()
            if self._keeps(name, value, ward)
        }
        facts["municipal_body"] = Sourced(body.name, provenance)
        facts["ward_number"] = Sourced(ward.ward_number, provenance)
        key = WardKey(self._city.city, body.slug, ward.ward_number)
        return WardRecord(key, self._city.state, facts, model)

    def _keeps(self, name: str, value: FactValue, ward: ExtractedWard) -> bool:
        if self._source.fields and name not in self._source.fields:
            return False
        # A count must sit in the ward's own snippet, not just somewhere on the page.
        if isinstance(value, Population) and str(value.count) not in digit_runs(ward.evidence):
            return False
        return self._check.holds(value)
