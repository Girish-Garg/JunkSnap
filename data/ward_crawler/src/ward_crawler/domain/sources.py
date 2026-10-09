"""What to crawl for a city, and the pages that come back."""

import re
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from functools import cached_property
from types import MappingProxyType

from ward_crawler.domain.provenance import Provenance
from ward_crawler.domain.utils import squash, words

MIN_SNIPPET = 4


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
    """`body`: whose ward numbers; `fields`: facts it may fill; `row_pattern`: regex fallback."""

    url: str
    holds: str
    body: str | None
    fields: tuple[str, ...] = ()
    row_pattern: str | None = None


@dataclass(frozen=True)
class CitySources:
    city: str
    state: str
    bodies: tuple[MunicipalBody, ...]
    bbox: BoundingBox
    sources: tuple[Source, ...]
    note: str = ""
    aliases: Mapping[str, str] = MappingProxyType({})

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
        """True when the snippet is on the page word for word (spacing and case ignored)."""
        needle = squash(snippet)
        return len(needle) >= MIN_SNIPPET and needle in self._squashed

    def mentions(self, text: str) -> bool:
        """True when every word of the text is a word on the page."""
        return bool(words(text)) and words(text) <= self._words

    @cached_property
    def _words(self) -> set[str]:
        return words(self.text)

    @cached_property
    def _squashed(self) -> str:
        return squash(self.text)
