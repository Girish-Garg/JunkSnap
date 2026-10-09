"""Reads one source: fetch the page, split it, ask the extractor, build sourced records."""

from dataclasses import dataclass

from ward_crawler.domain.city import SourceOutcome
from ward_crawler.domain.errors import ExtractionError, FetchError
from ward_crawler.domain.extraction import Extraction, ExtractionRequest
from ward_crawler.domain.sources import CitySources, Source
from ward_crawler.domain.ward import WardRecord
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
        self._records: list[WardRecord] = []

    def add(self, extraction: Extraction) -> None:
        self._proposed.update(ward.ward_number for ward in extraction.wards)
        self._records.extend(self._builder.build(extraction))

    def fail(self) -> None:
        self._failed += 1

    def records(self) -> tuple[WardRecord, ...]:
        return tuple(self._records)

    def detail(self) -> str:
        notes = [f"{self._read} of {self._chunks} chunk(s) read"]
        if self._failed:
            notes.append(f"{self._failed} chunk(s) got no valid model answer")
        kept = {record.key.number for record in self._records}
        notes.append(f"{len(self._proposed)} ward(s) proposed, {len(kept)} kept")
        dropped = sorted(self._proposed - kept)
        if dropped:
            notes.append("dropped as not shown on the page: " + ", ".join(map(str, dropped)))
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
        records = run.records()
        wards = len({record.key for record in records})
        return records, SourceOutcome(source, "fetched", run.detail(), page, wards)

    def _extract(self, request: ExtractionRequest, run: _PageRun) -> None:
        try:
            extraction = self._extractor.extract(request)
        except ExtractionError:
            run.fail()
            return
        run.add(extraction)
