"""Image labels (from Rekognition DetectLabels) and the keyword groups that score them.

Scoring is plain on purpose: a label in a report type's `strong` group counts its full
confidence, a label in its `weak` group counts WEAK_WEIGHT of it, and the score for that
type is the best single label. Labels are matched case-insensitively by exact name.
"""

from collections.abc import Mapping
from dataclasses import dataclass
from types import MappingProxyType

WEAK_WEIGHT = 0.6


@dataclass(frozen=True)
class DetectedLabel:
    """One label and its confidence, 0..1."""

    name: str
    confidence: float


@dataclass(frozen=True)
class LabelSet:
    """Every label a detector returned for one image, plus provenance."""

    labels: tuple[DetectedLabel, ...]
    model: str
    version: str
    latency_ms: int


@dataclass(frozen=True)
class KeywordGroup:
    """Label names that show one report type: strong evidence and weak evidence."""

    strong: frozenset[str]
    weak: frozenset[str] = frozenset()

    def weight(self, label_name: str) -> float:
        name = label_name.lower()
        if name in self.strong:
            return 1.0
        return WEAK_WEIGHT if name in self.weak else 0.0

    def score(self, labels: tuple[DetectedLabel, ...]) -> tuple[float, tuple[str, ...]]:
        """Best weighted confidence and the labels that matched, as 'name 0.97' notes."""
        matched = [(label, self.weight(label.name)) for label in labels]
        matched = [(label, weight) for label, weight in matched if weight > 0]
        best = max((label.confidence * weight for label, weight in matched), default=0.0)
        notes = tuple(f"{label.name} {label.confidence:.2f}" for label, _ in matched)
        return best, notes


_LOOSE_WASTE = frozenset(
    {"plastic", "plastic bag", "bag", "bottle", "cardboard", "carton", "paper", "tin", "can"}
)
_WASTE = frozenset(
    {"garbage", "trash", "rubbish", "litter", "waste", "landfill", "dump", "junk", "scrap"}
)

WASTE_KEYWORDS: Mapping[str, KeywordGroup] = MappingProxyType(
    {
        "waste_dump": KeywordGroup(strong=_WASTE, weak=_LOOSE_WASTE | {"pollution", "debris"}),
        "no_bin": KeywordGroup(
            strong=_WASTE | {"trash can", "garbage can", "dumpster", "bin"},
            weak=_LOOSE_WASTE,
        ),
        "contaminated_water": KeywordGroup(
            strong=frozenset(
                {"sewage", "sewer", "drain", "drainage", "gutter", "ditch", "pollution",
                 "algae", "foam", "puddle", "swamp"}
            ),
            weak=frozenset({"water", "pond", "canal", "mud", "river"}),
        ),
        "open_construction": KeywordGroup(
            strong=frozenset(
                {"rubble", "debris", "construction", "construction site", "brick", "bricks",
                 "gravel", "sand", "concrete", "cement", "demolition"}
            ),
            weak=frozenset({"soil", "dirt", "rock", "stone"}),
        ),
    }
)

# Smoke or flame: a hint for the judge and the logs, never part of the waste score.
BURNING_KEYWORDS = frozenset({"fire", "smoke", "flame", "bonfire", "ash"})
