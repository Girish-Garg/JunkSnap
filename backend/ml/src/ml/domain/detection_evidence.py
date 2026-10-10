"""How detector boxes support one claimed report type: one strategy class per kind of evidence."""

from abc import ABC, abstractmethod
from dataclasses import dataclass

from ml.domain.detections import DetectionSet

BIN = "bin"
# Waste that spills around a bin lies within half the bin's longer side of its box.
NEAR_REACH = 0.5
# A bin with no waste near it, or waste with no bin, is only half evidence of an overflowing bin.
ALONE_WEIGHT = 0.5


class DetectionEvidence(ABC):
    @abstractmethod
    def score(self, found: DetectionSet) -> float:
        """0..1 support that the claimed report type is visible."""


@dataclass(frozen=True)
class AnyClassEvidence(DetectionEvidence):
    """The best box of any of the classes."""

    classes: frozenset[str]

    def score(self, found: DetectionSet) -> float:
        return found.best(self.classes)


@dataclass(frozen=True)
class BinWithWasteEvidence(DetectionEvidence):
    """An overflowing bin: a bin box with a waste box touching it or within NEAR_REACH of it.

    A pair scores the weaker of its two confidences. A bin alone, or waste alone, scores
    ALONE_WEIGHT times its confidence, so it never reads as strong support.
    """

    waste: frozenset[str]
    reach: float = NEAR_REACH
    alone_weight: float = ALONE_WEIGHT

    def score(self, found: DetectionSet) -> float:
        waste = found.of(self.waste)
        paired = max(
            (
                min(bin_box.confidence, item.confidence)
                for bin_box in found.of({BIN})
                for item in waste
                if bin_box.near(item, self.reach)
            ),
            default=0.0,
        )
        return max(paired, self.alone_weight * found.best(self.waste | {BIN}))
