"""Meta-learner combiner (A2): a logistic model over signal scores, fitted on the val split."""

from collections.abc import Sequence

from ml.domain.case import CombinerInfo
from ml.domain.linear import MetaModel
from ml.domain.purposes import Purpose
from ml.domain.verification import Claim, Outcome, SignalResult, Thresholds
from ml.services.combiner import DISAGREEMENT_GAP, FixedWeightCombiner
from ml.services.combiner_base import Combiner
from ml.services.judge_decides_combiner import AUTO_CLAIM_REASON, JudgeDecidesCombiner

JUDGE_SIGNAL = "vision_judge"


class MetaLearnerCombiner(Combiner):
    KIND = "meta_learner"

    def __init__(
        self,
        model: MetaModel,
        thresholds: Thresholds,
        disagreement_gap: float = DISAGREEMENT_GAP,
        fallback: FixedWeightCombiner | None = None,
    ) -> None:
        """Same disagreement rule as the fixed weights, which decide what the model cannot."""
        self._model = model
        self._thresholds = thresholds
        self._gap = disagreement_gap
        if fallback is None:
            fallback = FixedWeightCombiner(thresholds, disagreement_gap=disagreement_gap)
        self._fallback = fallback

    @property
    def thresholds(self) -> Thresholds:
        return self._thresholds

    def info(self) -> CombinerInfo:
        return CombinerInfo(kind=self.KIND, version=self._model.version)

    def for_claim(self, claim: Claim, signals: Sequence[SignalResult] = ()) -> Combiner:
        """The fitted model decides only claims it has rows for and all its signals can see.

        Otherwise the judge decides on the v0 fixed weights, and blind signals count as absent.
        """
        kind = claim.report_type
        blind = [s.name for s in signals if s.neutral and s.name in self._model.base.signals]
        if self._model.covers(kind) and not blind:
            return JudgeDecidesCombiner(self, AUTO_CLAIM_REASON) if claim.judge_required else self
        if not self._model.covers(kind):
            reason = f"meta-learner has no training rows for {kind}; judge decides"
        else:
            reason = f"{', '.join(blind)} not trained for {kind}; judge decides"
        return JudgeDecidesCombiner(self._fallback, reason)

    def probability(self, signals: Sequence[SignalResult], purpose: Purpose) -> float:
        """Fitted on "waste is visible"; `support` maps a purpose's scores there and back."""
        waste = {s.name: purpose.support(s.score) for s in signals if not s.neutral}
        model = self._model.pick(frozenset(waste), JUDGE_SIGNAL in waste)
        return purpose.support(model.probability(waste))

    def disagree(self, signals: Sequence[SignalResult]) -> bool:
        scores = [signal.score for signal in signals if not signal.neutral]
        return len(scores) > 1 and max(scores) - min(scores) >= self._gap

    def combine(self, signals: Sequence[SignalResult], purpose: Purpose) -> Outcome:
        judged = any(signal.name == JUDGE_SIGNAL for signal in signals)
        probability = self.probability(signals, purpose)
        return purpose.outcome(probability, self.disagree(signals), self._thresholds, judged)
