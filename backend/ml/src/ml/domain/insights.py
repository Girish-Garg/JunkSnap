"""Insights beyond yes or no: waste composition, a coarse size class and hazards."""

from collections.abc import Mapping
from dataclasses import dataclass

MATERIALS = (
    "plastic", "organic", "construction_debris", "paper", "glass", "metal", "textile",
    "e_waste", "medical",
)
HAZARDS = ("burning", "medical_waste", "e_waste", "dead_animal", "chemicals")
SIZE_CLASSES = ("small", "medium", "large")


@dataclass(frozen=True)
class MaterialShare:
    material: str
    share: float
    source: str  # the signal name that saw it: rekognition_labels or vision_judge

    @staticmethod
    def normalized(weights: Mapping[str, float], source: str) -> tuple["MaterialShare", ...]:
        """Shares that sum to 1, largest first; empty when nothing was seen."""
        total = sum(weight for weight in weights.values() if weight > 0)
        if total <= 0:
            return ()
        shares = [MaterialShare(m, w / total, source) for m, w in weights.items() if w > 0]
        return tuple(sorted(shares, key=lambda share: -share.share))

    def to_contract(self) -> dict[str, object]:
        return {"material": self.material, "share": round(self.share, 2), "source": self.source}


@dataclass(frozen=True)
class Insights:
    composition: tuple[MaterialShare, ...] = ()
    size_class: str | None = None  # judge only, and never a weight or a count
    hazards: frozenset[str] = frozenset()

    @property
    def burning(self) -> bool:
        return "burning" in self.hazards

    def merged_with(self, later: "Insights") -> "Insights":
        """A later source's composition and size win when it gave them; hazards add up."""
        return Insights(
            composition=later.composition or self.composition,
            size_class=later.size_class or self.size_class,
            hazards=self.hazards | later.hazards,
        )

    def to_contract(self) -> dict[str, object]:
        return {
            "composition": [share.to_contract() for share in self.composition],
            "size_class": self.size_class,
            "hazards": [hazard for hazard in HAZARDS if hazard in self.hazards],
            "burning": self.burning,
        }
