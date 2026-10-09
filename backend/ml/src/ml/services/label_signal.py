"""Signal from Rekognition DetectLabels, scored with keyword groups per report type."""

from collections.abc import Mapping

from ml.domain.case import VerificationCase
from ml.domain.label_insights import LabelInsights
from ml.domain.labels import WASTE_KEYWORDS, KeywordGroup
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
    ) -> None:
        self._detector = detector
        self._insights = insights
        self._keywords = dict(keywords)

    def measure(self, case: VerificationCase) -> SignalResult:
        labels = self._detector.detect(case.image)
        waste_score, notes = self._keywords[case.claim.report_type].score(labels.labels)
        return SignalResult(
            name=self.NAME,
            score=case.purpose.support(waste_score),
            provider=self.PROVIDER,
            model=labels.model,
            version=labels.version,
            latency_ms=labels.latency_ms,
            notes=notes,
            insights=self._insights.read(labels.labels),
        )
