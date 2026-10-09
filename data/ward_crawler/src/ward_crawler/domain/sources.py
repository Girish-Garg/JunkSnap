"""What to crawl for a city, and the pages that come back."""

import re
from dataclasses import dataclass
from datetime import datetime
from difflib import SequenceMatcher
from functools import cached_property

from ward_crawler.domain.provenance import Provenance
from ward_crawler.domain.utils import digit_runs, squash

MIN_SNIPPET = 4
SHARED_RUN = 0.6  # share of a snippet that must appear on the page as one unbroken run


@dataclass(frozen=True)
class MunicipalBody:
    slug: str
    name: str


@dataclass(frozen=True)
class BoundingBox:
    south: float
    west: float
    north: float
    east: float


@dataclass(frozen=True)
class Source:
    """`body` is the slug its ward numbers belong to; `fields` limits which facts are kept."""

    url: str
    holds: str
    body: str | None
    fields: tuple[str, ...] = ()


@dataclass(frozen=True)
class CitySources:
    city: str
    state: str
    bodies: tuple[MunicipalBody, ...]
    bbox: BoundingBox
    sources: tuple[Source, ...]
    note: str = ""

    def body(self, slug: str) -> MunicipalBody | None:
        return next((body for body in self.bodies if body.slug == slug), None)


@dataclass(frozen=True)
class Page:
    """A fetched page as text, with the hash of the bytes that were fetched."""

    url: str
    text: str
    sha256: str
    fetched_at: datetime

    def provenance(self) -> Provenance:
        return Provenance(self.url, self.fetched_at, self.sha256)

    def chunks(self, max_chars: int) -> tuple[str, ...]:
        """Pieces of about max_chars, cut at PDF page breaks when a page fits, else at lines."""
        units: list[str] = []
        for block in re.split(r"(?=\[page \d+\]\n)", self.text):
            units.extend([block] if len(block) <= max_chars else block.splitlines(keepends=True))
        pieces: list[str] = []
        current = ""
        for unit in units:
            if current and len(current) + len(unit) > max_chars:
                pieces.append(current)
                current = ""
            current += unit
        if current.strip():
            pieces.append(current)
        return tuple(pieces)

    def supports(self, snippet: str) -> bool:
        """True when the snippet is on the page, allowing small copy slips in garbled PDF text."""
        needle, haystack = squash(snippet), self._squashed
        if len(needle) < MIN_SNIPPET or not digit_runs(snippet) <= digit_runs(self.text):
            return False
        if needle in haystack:
            return True
        matcher = SequenceMatcher(None, haystack, needle, autojunk=False)
        block = matcher.find_longest_match(0, len(haystack), 0, len(needle))
        return block.size >= SHARED_RUN * len(needle)

    def mentions(self, text: str) -> bool:
        """Short text must be on the page as written; longer text may have small slips."""
        needle = squash(text)
        return bool(needle) and (needle in self._squashed or self.supports(text))

    @cached_property
    def _squashed(self) -> str:
        return squash(self.text)
