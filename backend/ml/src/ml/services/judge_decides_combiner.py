"""For an untrained type or an auto claim: no decision without the judge's answer."""

from collections.abc import Sequence
from dataclasses import replace
from typing import override

from ml.domain.case import CombinerInfo
from ml.domain.purposes import Purpose
from ml.domain.verification import Claim, Outcome, SignalResult, Thresholds
from ml.services.combiner_base import Combiner

# A scan frame's auto claim (contracts v1.10): only the judge names a type or place.
AUTO_CLAIM_REASON = "auto claim: the judge names the type or place"
JUDGE_SIGNAL = "vision_judge"


class JudgeDecidesCombiner(Combiner):
    """Decorator: the inner combiner decides with the judge's answer; the reason is logged.

    On the fixed weights the judge carries the largest weight, so it leads.
    Without a judge answer the claim cannot be settled, so the probability is 0.5: a report
    goes to community check, never rejected or auto-verified by detectors blind to the claim.
    """

    def __init__(self, inner: Combiner, reason: str) -> None:
        self._inner = inner
        self._reason = reason

    @property
    def thresholds(self) -> Thresholds:
        return self._inner.thresholds

    def info(self) -> CombinerInfo:
        return replace(self._inner.info(), reason=self._reason)

    @override
    def for_claim(self, claim: Claim, signals: Sequence[SignalResult] = ()) -> Combiner:
        return self

    def combine(self, signals: Sequence[SignalResult], purpose: Purpose) -> Outcome:
        if any(signal.name == JUDGE_SIGNAL for signal in signals):
            return self._inner.combine(signals, purpose)
        unknown = self.thresholds.community_check_min
        return purpose.outcome(unknown, False, self.thresholds, False)
