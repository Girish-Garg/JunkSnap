"""Wards as the sources describe them, the places found for them, and the shapes built."""

from dataclasses import dataclass, field
from datetime import UTC, datetime


class WardBoundariesError(Exception):
    """Root of every error raised by the ward boundary builder."""


@dataclass(frozen=True)
class Document:
    """A fetched page: its text plus where and when it came from."""

    url: str
    text: str
    sha256: str
    fetched_at: datetime

    def provenance(self) -> dict[str, str]:
        moment = self.fetched_at.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
        return {"source_url": self.url, "page_sha256": self.sha256, "fetched_at": moment}


@dataclass(frozen=True)
class WardText:
    """One ward as one source lists it: its number, the places it includes, its population."""

    number: int
    places: tuple[str, ...]
    population: int | None
    source: Document
    models: tuple[str, ...] = ()


@dataclass(frozen=True)
class Place:
    """A named OpenStreetMap feature with a point (lat, lon)."""

    name: str
    lat: float
    lon: float
    ref: str


@dataclass(frozen=True)
class WardEvidence:
    """Everything gathered for one ward, ready to be turned into a polygon."""

    number: int
    listed: tuple[str, ...]
    matched: tuple[tuple[str, Place], ...]
    population: int | None
    sources: tuple[Document, ...]
    notes: tuple[str, ...] = field(default=())
    in_gazette: bool = False
    seat_agrees: bool = False
    layout_agrees: bool | None = None
    models: tuple[str, ...] = ()

    def share_matched(self) -> float:
        names = {listed for listed, _ in self.matched}
        return len(names) / len(self.listed) if self.listed else 0.0

    def places_found(self) -> int:
        return len({listed for listed, _ in self.matched})

    def confidence(self) -> float:
        """More localities found, a larger share of the list, and a gazette row all raise it."""
        spread = min(1.0, self.places_found() / 4)
        gazette = 0.1 if self.in_gazette else 0.0
        checks = (0.1 if self.seat_agrees else 0.0) + {True: 0.1, False: -0.2, None: 0.0}[
            self.layout_agrees
        ]
        score = 0.5 * spread + 0.4 * self.share_matched() + gazette + checks
        return round(min(1.0, max(0.0, score)), 2)
