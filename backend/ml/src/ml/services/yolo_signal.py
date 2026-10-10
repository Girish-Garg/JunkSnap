"""Signal from our trained detector: waste boxes for the claim, plus burning and a size class."""

from collections.abc import Mapping
from types import MappingProxyType

from ml.domain.case import VerificationCase
from ml.domain.detection_evidence import AnyClassEvidence, BinWithWasteEvidence, DetectionEvidence
from ml.domain.detections import DetectionSet
from ml.domain.insights import HazardSighting, Insights, InsightSource, SizeEstimate
from ml.domain.verification import SignalResult
from ml.ports.object_detector import ObjectDetector
from ml.ports.signal import Signal

WASTE_CLASSES = frozenset({"waste_pile", "bag", "waste_item"})
# How detector boxes show each claimed report type; no class sees contaminated water.
CLAIM_EVIDENCE: Mapping[str, DetectionEvidence] = MappingProxyType(
    {
        "waste_dump": AnyClassEvidence(WASTE_CLASSES),
        "no_bin": AnyClassEvidence(WASTE_CLASSES),
        "open_construction": AnyClassEvidence(frozenset({"waste_pile"})),
        "overflowing_bin": BinWithWasteEvidence(WASTE_CLASSES),
    }
)
# A claim the detector cannot see gets this score, flagged neutral so combiners skip it.
NEUTRAL = 0.5
BURNING_MIN = 0.5
SIZE_BOX_MIN = 0.4
# Share of the image under waste boxes: below 10% small, below 35% medium, else large.
SIZE_BANDS = ((0.10, "small"), (0.35, "medium"))


class YoloSignal(Signal):
    NAME = "yolo"
    PROVIDER = "junksnap"

    def __init__(self, detector: ObjectDetector) -> None:
        self._detector = detector

    def measure(self, case: VerificationCase) -> SignalResult:
        found = self._detector.detect(case.image)
        evidence = CLAIM_EVIDENCE.get(case.claim.report_type)
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

    @staticmethod
    def _size(found: DetectionSet, source: InsightSource) -> SizeEstimate | None:
        share = found.coverage(WASTE_CLASSES, SIZE_BOX_MIN)
        if share <= 0:
            return None
        value = next((name for limit, name in SIZE_BANDS if share < limit), "large")
        return SizeEstimate(value, source)

    @staticmethod
    def _fire(found: DetectionSet, source: InsightSource) -> tuple[HazardSighting, ...]:
        confidence = found.best({"burning"})
        if confidence < BURNING_MIN:
            return ()
        return (HazardSighting("burning", confidence, source),)
