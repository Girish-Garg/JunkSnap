"""Insights beyond yes or no: composition, a coarse size class and hazards, each with its model."""

from collections.abc import Mapping
from dataclasses import dataclass, replace

MATERIALS = (
    "plastic", "organic", "construction_debris", "paper", "glass", "metal", "textile",
    "e_waste", "medical",
)
HAZARDS = ("burning", "medical_waste", "e_waste", "dead_animal", "chemicals")
SIZE_CLASSES = ("small", "medium", "large")


@dataclass(frozen=True)
class InsightSource:
    signal: str
    provider: str
    model: str
    version: str

    def to_contract(self) -> dict[str, object]:
        return {
            "signal": self.signal,
            "provider": self.provider,
            "model": self.model,
            "version": self.version,
        }


@dataclass(frozen=True)
class MaterialShare:
    material: str
    share: float  # 0..1 of the visible waste
    source: InsightSource

    @staticmethod
    def from_weights(
        weights: Mapping[str, float], source: InsightSource
    ) -> tuple["MaterialShare", ...]:
        return MaterialShare.capped(
            tuple(MaterialShare(m, w, source) for m, w in weights.items() if w > 0)
        )

    @staticmethod
    def capped(
        shares: tuple["MaterialShare", ...], room: float = 1.0
    ) -> tuple["MaterialShare", ...]:
        """Largest first, scaled down only when they add up to more than `room`."""
        total = sum(share.share for share in shares)
        scale = room / total if total > room else 1.0
        scaled = [replace(share, share=share.share * scale) for share in shares]
        return tuple(sorted((s for s in scaled if s.share > 0), key=lambda s: -s.share))

    def to_contract(self) -> dict[str, object]:
        return {
            "material": self.material,
            "share_pct": round(self.share * 100, 1),
            "source": self.source.to_contract(),
        }


@dataclass(frozen=True)
class SizeEstimate:
    value: str  # small, medium or large; never a weight
    source: InsightSource

    def to_contract(self) -> dict[str, object]:
        return {"value": self.value, "source": self.source.to_contract()}


@dataclass(frozen=True)
class HazardSighting:
    hazard: str
    confidence: float
    source: InsightSource

    def to_contract(self) -> dict[str, object]:
        return {
            "hazard": self.hazard,
            "confidence": round(self.confidence, 2),
            "source": self.source.to_contract(),
        }


@dataclass(frozen=True)
class Insights:
    composition: tuple[MaterialShare, ...] = ()
    size_class: SizeEstimate | None = None
    hazards: tuple[HazardSighting, ...] = ()
    decides_burning: bool = False  # the judge's burning verdict replaces what labels saw

    @property
    def burning(self) -> bool:
        return any(sighting.hazard == "burning" for sighting in self.hazards)

    def merged_with(self, later: "Insights") -> "Insights":
        """The later source (the judge) wins; earlier ones only fill what it did not measure."""
        listed = {share.material for share in later.composition}
        room = max(1.0 - sum(share.share for share in later.composition), 0.0)
        fills = tuple(share for share in self.composition if share.material not in listed)
        composition = later.composition + MaterialShare.capped(fills, room)
        replaced = {s.hazard for s in later.hazards}
        if later.decides_burning:
            replaced.add("burning")
        hazards = [s for s in self.hazards if s.hazard not in replaced] + list(later.hazards)
        return Insights(
            composition=tuple(sorted(composition, key=lambda share: -share.share)),
            size_class=later.size_class or self.size_class,
            hazards=tuple(hazards),
            decides_burning=self.decides_burning or later.decides_burning,
        )

    def to_contract(self) -> dict[str, object]:
        hazards = sorted(self.hazards, key=lambda sighting: HAZARDS.index(sighting.hazard))
        return {
            "composition": [share.to_contract() for share in self.composition[: len(MATERIALS)]],
            "size_class": None if self.size_class is None else self.size_class.to_contract(),
            "hazards": [sighting.to_contract() for sighting in hazards],
        }
