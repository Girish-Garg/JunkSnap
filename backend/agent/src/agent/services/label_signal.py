"""Signal from Rekognition DetectLabels: keyword groups per report type (domain/labels.py)."""

from collections.abc import Mapping

from agent.domain.case import VerificationCase
from agent.domain.labels import BURNING_KEYWORDS, WASTE_KEYWORDS, KeywordGroup, LabelSet
from agent.domain.verification import SignalResult
from agent.ports.label_detector import LabelDetector
from agent.ports.signal import Signal


class RekognitionLabelSignal(Signal):
    """Scores the claimed report type's keyword group over the detected labels.

    The waste score is the best matching label's confidence (weak keywords count less); the
    case's purpose turns it into support for its claim (cleanup: 1 - waste score).
    """

    NAME = "rekognition_labels"
    PROVIDER = "rekognition"

    def __init__(
        self, detector: LabelDetector, keywords: Mapping[str, KeywordGroup] = WASTE_KEYWORDS
    ) -> None:
        self._detector = detector
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
            notes=notes + self._burning_notes(labels),
        )

    def _burning_notes(self, labels: LabelSet) -> tuple[str, ...]:
        return tuple(
            f"burning? {label.name} {label.confidence:.2f}"
            for label in labels.labels
            if label.name.lower() in BURNING_KEYWORDS
        )
