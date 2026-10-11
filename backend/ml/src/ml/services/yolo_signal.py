"""Signal from our trained detector: waste boxes for the claim, plus burning and a size class."""

from collections.abc import Mapping
from dataclasses import dataclass
from types import MappingProxyType

from ml.domain.case import VerificationCase
from ml.domain.detection_evidence import (
    ALONE_WEIGHT,
    NEAR_REACH,
    AnyClassEvidence,
    BinWithWasteEvidence,
    DetectionEvidence,
)
from ml.domain.detections import DetectionSet
from ml.domain.insights import (
    HAZARD_MIN,
    HazardSighting,
    Insights,
    InsightSource,
    SizeEstimate,
)
from ml.domain.verification import SignalResult
from ml.ports.object_detector import ObjectDetector
from ml.ports.signal import Signal

WASTE_CLASSES = frozenset({"waste_pile", "bag", "waste_item"})
# A claim the detector cannot see gets this score, flagged neutral so combiners skip it.
NEUTRAL = 0.5


@dataclass(frozen=True)
class YoloOptions:
    """Hand-set numbers that turn boxes into support and insights (the ML_YOLO_* variables)."""

    hazard_min: float = HAZARD_MIN  # a burning box this sure is a hazard
    size_box_min: float = 0.4  # boxes this sure count toward the size class
    small_max: float = 0.10  # share of the image under waste boxes: below it small
    medium_max: float = 0.35  # below it medium, else large
    bin_reach: float = NEAR_REACH
    bin_alone_weight: float = ALONE_WEIGHT

    def evidence(self) -> Mapping[str, DetectionEvidence]:
        """How boxes show each claimed report type; unlisted claims are neutral."""
        # No class sees contaminated water, and none sees construction debris: waste_pile boxes
        # are a teacher's "pile of garbage", so a flyover site without one is not a "no" (#111).
        overflowing = BinWithWasteEvidence(WASTE_CLASSES, self.bin_reach, self.bin_alone_weight)
        return MappingProxyType({
            "waste_dump": AnyClassEvidence(WASTE_CLASSES),
            "no_bin": AnyClassEvidence(WASTE_CLASSES),
            "overflowing_bin": overflowing,
        })

    def size_class(self, share: float) -> str:
        if share < self.small_max:
            return "small"
        return "medium" if share < self.medium_max else "large"


DEFAULT_OPTIONS = YoloOptions()


class YoloSignal(Signal):
    NAME = "yolo"
    PROVIDER = "junksnap"

    def __init__(self, detector: ObjectDetector, options: YoloOptions = DEFAULT_OPTIONS) -> None:
        self._detector = detector
        self._options = options
        self._evidence = options.evidence()

    def measure(self, case: VerificationCase) -> SignalResult:
        found = self._detector.detect(case.image)
        evidence = self._evidence.get(case.claim.report_type)
        waste_score = NEUTRAL if evidence is None else evidence.score(found)
        source = InsightSource(self.NAME, self.PROVIDER, found.model, found.version)
        return SignalResult(
            name=self.NAME,
            score=case.purpose.support(waste_score),
            provider=self.PROVIDER,
            model=found.model,
            version=found.version,
            latency_ms=found.latency_ms,
            notes=found.notes() if evidence else (f"no class for {case.claim.report_type}",),
            insights=Insights(
                size_class=self._size(found, source), hazards=self._fire(found, source)
            ),
            neutral=evidence is None,
        )

    def _size(self, found: DetectionSet, source: InsightSource) -> SizeEstimate | None:
        share = found.coverage(WASTE_CLASSES, self._options.size_box_min)
        if share <= 0:
            return None
        return SizeEstimate(self._options.size_class(share), source)

    def _fire(self, found: DetectionSet, source: InsightSource) -> tuple[HazardSighting, ...]:
        confidence = found.best({"burning"})
        if confidence < self._options.hazard_min:
            return ()
        return (HazardSighting("burning", confidence, source),)
