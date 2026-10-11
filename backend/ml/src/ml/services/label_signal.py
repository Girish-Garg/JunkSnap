"""Signal from Rekognition DetectLabels, scored with keyword groups per report type."""

from collections.abc import Mapping

from ml.domain.case import VerificationCase
from ml.domain.insights import InsightSource
from ml.domain.label_insights import LabelInsights
from ml.domain.labels import WASTE_KEYWORDS, WEAK_WEIGHT, KeywordGroup
from ml.domain.verification import SignalResult
from ml.ports.label_detector import LabelDetector
from ml.ports.signal import Signal


class RekognitionLabelSignal(Signal):
    NAME = "rekognition_labels"
    PROVIDER = "rekognition"

    def __init__(
        self,
        detector: LabelDetector,
        insights: LabelInsights,
        keywords: Mapping[str, KeywordGroup] = WASTE_KEYWORDS,
        weak_weight: float = WEAK_WEIGHT,
    ) -> None:
        self._detector = detector
        self._insights = insights
        self._keywords = dict(keywords)
        self._weak_weight = weak_weight

    def measure(self, case: VerificationCase) -> SignalResult:
        labels = self._detector.detect(case.image)
        group = self._keywords[case.claim.report_type]
        waste_score, notes = group.score(labels.labels, self._weak_weight)
        source = InsightSource(self.NAME, self.PROVIDER, labels.model, labels.version)
        return SignalResult(
            name=self.NAME,
            score=case.purpose.support(waste_score),
            provider=self.PROVIDER,
            model=labels.model,
            version=labels.version,
            latency_ms=labels.latency_ms,
            notes=notes,
            insights=self._insights.read(labels.labels, source),
        )
