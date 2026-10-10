"""Reads one source: fetch the page, split it, ask the extractor, build sourced records."""

from dataclasses import dataclass

from ward_crawler.domain.city import SourceOutcome
from ward_crawler.domain.errors import ExtractionError, FetchError
from ward_crawler.domain.extraction import Extraction, ExtractionRequest
from ward_crawler.domain.row_pattern import RowPattern
from ward_crawler.domain.sources import CitySources, Source
from ward_crawler.domain.ward import WardKey, WardRecord
from ward_crawler.ports.page_fetcher import PageFetcher
from ward_crawler.ports.record_extractor import RecordExtractor
from ward_crawler.services.record_builder import RecordBuilder


@dataclass(frozen=True)
class ReadLimits:
    chunk_chars: int = 3_000
    max_chunks: int = 60


class _PageRun:
    """Records and counts for one page, summed up in the source log."""

    def __init__(self, builder: RecordBuilder, chunks: int, read: int) -> None:
        self._builder = builder
        self._chunks = chunks
        self._read = read
        self._failed = 0
        self._proposed: set[int] = set()
        self._records: dict[WardKey, WardRecord] = {}
        self._filled: list[int] = []
        self._corrected: list[int] = []

    def add(self, extraction: Extraction) -> None:
        self._proposed.update(ward.ward_number for ward in extraction.wards)
        for record in self._builder.build(extraction):
            known = self._records.get(record.key)
            self._records[record.key] = record if known is None else known.merged_with(record)

    def add_rows(self, extraction: Extraction) -> None:
        """Rows read by the pattern fill wards the model missed and win where they disagree."""
        for row in self._builder.build(extraction):
            known = self._records.get(row.key)
            if known is None:
                self._filled.append(row.key.number)
                self._records[row.key] = row
            elif known.disagrees_with(row):
                self._corrected.append(row.key.number)
                self._records[row.key] = row
            else:
                self._records[row.key] = known.merged_with(row)

    def fail(self) -> None:
        self._failed += 1

    def records(self) -> tuple[WardRecord, ...]:
        return tuple(self._records.values())

    def detail(self) -> str:
        notes = [f"{self._read} of {self._chunks} chunk(s) read"]
        if self._failed:
            notes.append(f"{self._failed} chunk(s) got no valid model answer")
        kept = {key.number for key in self._records}
        notes.append(f"model proposed {len(self._proposed)} ward(s); {len(kept)} kept in all")
        for label, numbers in (
            ("filled by the row pattern", self._filled),
            ("corrected by the row pattern", self._corrected),
            ("dropped as not shown on the page", self._proposed - kept),
        ):
            if numbers:
                notes.append(f"{label}: " + ", ".join(map(str, sorted(numbers))))
        return "; ".join(notes)


class SourceReader:
    def __init__(
        self, fetcher: PageFetcher, extractor: RecordExtractor, limits: ReadLimits
    ) -> None:
        self._fetcher = fetcher
        self._extractor = extractor
        self._limits = limits

    def read(
        self, city: CitySources, source: Source
    ) -> tuple[tuple[WardRecord, ...], SourceOutcome]:
        try:
            page = self._fetcher.fetch(source.url)
        except FetchError as error:
            return (), SourceOutcome(source, "unreachable", str(error))
        chunks = page.chunks(self._limits.chunk_chars)
        if not chunks:
            return (), SourceOutcome(source, "no_text", "page has no extractable text", page)
        to_read = chunks[: self._limits.max_chunks]
        run = _PageRun(RecordBuilder(city, page, source), len(chunks), len(to_read))
        for chunk in to_read:
            self._extract(ExtractionRequest(city.city, city.bodies, source, chunk), run)
        if source.row_pattern:
            pattern = RowPattern(source.row_pattern)
            run.add_rows(Extraction(pattern.wards(page, source.body or ""), pattern.model()))
        records = run.records()
        return records, SourceOutcome(source, "fetched", run.detail(), page, len(records))

    def _extract(self, request: ExtractionRequest, run: _PageRun) -> None:
        try:
            extraction = self._extractor.extract(request)
        except ExtractionError:
            run.fail()
            return
        run.add(extraction)
