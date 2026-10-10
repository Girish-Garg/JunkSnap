"""Meta-learner combiner (A2): a logistic model over signal scores, fitted on the val split."""

from collections.abc import Sequence

from ml.domain.case import CombinerInfo
from ml.domain.linear import MetaModel
from ml.domain.purposes import Purpose
from ml.domain.verification import Outcome, SignalResult, Thresholds
from ml.services.combiner_base import Combiner

# Same rule as the fixed-weight combiner: scores this far apart strongly disagree.
DISAGREEMENT_GAP = 0.5
JUDGE_SIGNAL = "vision_judge"


class MetaLearnerCombiner(Combiner):
    KIND = "meta_learner"

    def __init__(
        self, model: MetaModel, thresholds: Thresholds, disagreement_gap: float = DISAGREEMENT_GAP
    ) -> None:
        self._model = model
        self._thresholds = thresholds
        self._gap = disagreement_gap

    @property
    def thresholds(self) -> Thresholds:
        return self._thresholds

    def info(self) -> CombinerInfo:
        return CombinerInfo(kind=self.KIND, version=self._model.version)

    def probability(self, signals: Sequence[SignalResult], purpose: Purpose) -> float:
        """Fitted on "waste is visible"; `support` maps a purpose's scores there and back."""
        waste = {s.name: purpose.support(s.score) for s in signals if not s.neutral}
        model = self._model.judged if JUDGE_SIGNAL in waste else self._model.base
        return purpose.support(model.probability(waste))

    def disagree(self, signals: Sequence[SignalResult]) -> bool:
        scores = [signal.score for signal in signals if not signal.neutral]
        return len(scores) > 1 and max(scores) - min(scores) >= self._gap

    def needs_judge(self, signals: Sequence[SignalResult], purpose: Purpose) -> bool:
        if purpose.requires_judge or self.disagree(signals):
            return True
        return self._thresholds.is_unsure(self.probability(signals, purpose))

    def combine(self, signals: Sequence[SignalResult], purpose: Purpose) -> Outcome:
        judged = any(signal.name == JUDGE_SIGNAL for signal in signals)
        probability = self.probability(signals, purpose)
        return purpose.outcome(probability, self.disagree(signals), self._thresholds, judged)
