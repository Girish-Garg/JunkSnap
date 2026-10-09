"""A ward record: sourced facts about one ward of one municipal body."""

from collections.abc import Mapping
from dataclasses import asdict, dataclass, field, replace
from datetime import datetime
from types import MappingProxyType

from ward_crawler.domain.errors import InvalidRecordError
from ward_crawler.domain.provenance import Provenance, Sourced

FACT_FIELDS = (
    "municipal_body",
    "ward_number",
    "zone",
    "ward_name",
    "area_km2",
    "population",
    "councillor_seat",
    "sanitation_office",
    "assembly_seat",
    "lok_sabha_seat",
)
REVIEW_STATUSES = ("unreviewed", "reviewed", "rejected")


@dataclass(frozen=True)
class WardKey:
    city: str
    body: str
    number: int

    @property
    def id(self) -> str:
        return f"{self.city}-{self.body}-{self.number:03d}"


@dataclass(frozen=True)
class ModelInfo:
    """Which model produced a decision, as every JunkSnap decision must record."""

    provider: str
    model: str
    version: str


@dataclass(frozen=True)
class DisposalPoint:
    lat: float
    lon: float
    kind: str
    ref: str
    provenance: Provenance

    def to_json(self) -> dict[str, object]:
        place = {"lat": self.lat, "lon": self.lon, "kind": self.kind, "ref": self.ref}
        return {**place, **self.provenance.to_json()}


@dataclass(frozen=True)
class WardRecord:
    """Facts about one ward. Unknown facts are simply absent and written as null."""

    key: WardKey
    state: str
    facts: Mapping[str, Sourced]
    extracted_by: ModelInfo
    disposal_points: tuple[DisposalPoint, ...] = ()
    review_status: str = field(default="unreviewed")

    def __post_init__(self) -> None:
        unknown = set(self.facts) - set(FACT_FIELDS)
        if unknown:
            raise InvalidRecordError(f"{self.key.id}: unknown fields {sorted(unknown)}")
        if not {"municipal_body", "ward_number"} <= set(self.facts):
            raise InvalidRecordError(f"{self.key.id}: needs a sourced body and ward number")
        if self.review_status not in REVIEW_STATUSES:
            raise InvalidRecordError(f"{self.key.id}: bad review_status {self.review_status}")
        object.__setattr__(self, "facts", MappingProxyType(dict(self.facts)))

    def merged_with(self, other: "WardRecord") -> "WardRecord":
        """Combine two records for the same ward; each field keeps its newest value."""
        if other.key != self.key:
            raise InvalidRecordError(f"cannot merge {self.key.id} with {other.key.id}")
        merged: dict[str, Sourced] = dict(self.facts)
        for name, fact in other.facts.items():
            existing = merged.get(name)
            merged[name] = fact if existing is None else existing.newest(fact)
        newest = other if other.latest_fetch() > self.latest_fetch() else self
        points = {point.ref: point for point in self.disposal_points + other.disposal_points}
        return replace(
            self,
            facts=merged,
            extracted_by=newest.extracted_by,
            disposal_points=tuple(points.values()),
        )

    def latest_fetch(self) -> datetime:
        return max(fact.provenance.fetched_at for fact in self.facts.values())

    def filled_fields(self) -> tuple[str, ...]:
        filled = [name for name in FACT_FIELDS if name in self.facts]
        return (*filled, "disposal_points") if self.disposal_points else tuple(filled)

    def to_json(self) -> dict[str, object]:
        facts = {name: self._fact_json(name) for name in FACT_FIELDS}
        points = [point.to_json() for point in self.disposal_points] or None
        return {
            "id": self.key.id,
            "city": self.key.city,
            "state": self.state,
            **facts,
            "disposal_points": points,
            "review_status": self.review_status,
            "extracted_by": asdict(self.extracted_by),
        }

    def _fact_json(self, name: str) -> object:
        fact = self.facts.get(name)
        return None if fact is None else fact.to_json()
