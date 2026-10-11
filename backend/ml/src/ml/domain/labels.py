"""Image labels and the keyword groups that turn them into a waste score per report type."""

from collections.abc import Mapping
from dataclasses import dataclass
from types import MappingProxyType

WEAK_WEIGHT = 0.6  # ML_LABEL_WEAK_WEIGHT


@dataclass(frozen=True)
class DetectedLabel:
    name: str
    confidence: float  # 0..1


@dataclass(frozen=True)
class LabelSet:
    labels: tuple[DetectedLabel, ...]
    model: str
    version: str
    latency_ms: int


@dataclass(frozen=True)
class KeywordGroup:
    """Lower-case label names that show one report type; a weak one counts `weak_weight`."""

    strong: frozenset[str]
    weak: frozenset[str] = frozenset()

    def weight(self, label_name: str, weak_weight: float = WEAK_WEIGHT) -> float:
        name = label_name.lower()
        if name in self.strong:
            return 1.0
        return weak_weight if name in self.weak else 0.0

    def score(
        self, labels: tuple[DetectedLabel, ...], weak_weight: float = WEAK_WEIGHT
    ) -> tuple[float, tuple[str, ...]]:
        """The best single weighted confidence, and the matched labels as notes."""
        matched = [(label, self.weight(label.name, weak_weight)) for label in labels]
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
_BINS = frozenset({"trash can", "garbage can", "dumpster", "bin", "waste container"})

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
        # Labels cannot tell a full bin from a tidy one, so a bin alone is only weak.
        "overflowing_bin": KeywordGroup(strong=_WASTE, weak=_BINS | _LOOSE_WASTE),
        # Area scout (contracts v1.10): litter is strong; sewage, rubble or a bin alone is weak.
        "auto": KeywordGroup(
            strong=_WASTE,
            weak=_LOOSE_WASTE | _BINS | {"sewage", "sewer", "gutter", "foam", "rubble", "debris"},
        ),
    }
)
