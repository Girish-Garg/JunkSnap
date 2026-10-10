"""Fixed-weight combiner (v0): a weighted mean of signal scores, before the meta-learner."""

from collections.abc import Mapping, Sequence
from types import MappingProxyType

from ml.domain.case import CombinerInfo
from ml.domain.errors import ConfigError
from ml.domain.purposes import Purpose
from ml.domain.verification import Outcome, SignalResult, Thresholds
from ml.services.combiner_base import Combiner

# Hand-set, not fitted. The judge only runs on unsure or split cases, so it breaks ties.
FIXED_WEIGHTS: Mapping[str, float] = MappingProxyType(
    {"rekognition_labels": 0.4, "yolo": 0.3, "embedding_classifier": 0.3, "vision_judge": 0.6}
)
# Two scores this far apart on 0..1 strongly disagree.
DISAGREEMENT_GAP = 0.5
JUDGE_SIGNAL = "vision_judge"


class FixedWeightCombiner(Combiner):
    KIND = "fixed_weights"
    VERSION = "fw-v0"

    def __init__(
        self,
        thresholds: Thresholds,
        weights: Mapping[str, float] = FIXED_WEIGHTS,
        disagreement_gap: float = DISAGREEMENT_GAP,
    ) -> None:
        self._thresholds = thresholds
        self._weights = dict(weights)
        self._gap = disagreement_gap

    @property
    def thresholds(self) -> Thresholds:
        return self._thresholds

    def info(self) -> CombinerInfo:
        return CombinerInfo(kind=self.KIND, version=self.VERSION)

    def probability(self, signals: Sequence[SignalResult]) -> float:
        weights = [self._weight(signal.name) for signal in signals]
        if not signals or sum(weights) <= 0:
            raise ConfigError("the combiner needs at least one weighted signal")
        total = sum(weight * signal.score for weight, signal in zip(weights, signals, strict=True))
        return total / sum(weights)

    def disagree(self, signals: Sequence[SignalResult]) -> bool:
        scores = [signal.score for signal in signals if not signal.neutral]
        return len(scores) > 1 and max(scores) - min(scores) >= self._gap

    def needs_judge(self, signals: Sequence[SignalResult], purpose: Purpose) -> bool:
        if purpose.requires_judge or self.disagree(signals):
            return True
        return self._thresholds.is_unsure(self.probability(signals))

    def combine(self, signals: Sequence[SignalResult], purpose: Purpose) -> Outcome:
        judged = any(signal.name == JUDGE_SIGNAL for signal in signals)
        probability = self.probability(signals)
        return purpose.outcome(probability, self.disagree(signals), self._thresholds, judged)

    def _weight(self, name: str) -> float:
        if name not in self._weights:
            raise ConfigError(f"no fixed weight for signal {name!r}")
        return self._weights[name]
