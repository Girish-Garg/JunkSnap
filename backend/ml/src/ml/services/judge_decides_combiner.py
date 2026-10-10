"""Fallback for a claim the meta-learner was never fitted on: the judge always runs and leads."""

from collections.abc import Sequence
from dataclasses import replace
from typing import override

from ml.domain.case import CombinerInfo
from ml.domain.purposes import Purpose
from ml.domain.verification import Claim, Outcome, SignalResult, Thresholds
from ml.services.combiner_base import Combiner

# A scan frame's auto claim (contracts v1.10): only the judge names a type or place.
AUTO_CLAIM_REASON = "auto claim: the judge names the type or place"


class JudgeDecidesCombiner(Combiner):
    """Decorator: asks for the judge on every case; the inner combiner (fixed weights) decides.

    The judge carries the largest fixed weight, so it leads; the reason says why in the log.
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
    def for_claim(self, claim: Claim) -> Combiner:
        return self

    @override
    def needs_judge(self, signals: Sequence[SignalResult], purpose: Purpose) -> bool:
        return True

    def combine(self, signals: Sequence[SignalResult], purpose: Purpose) -> Outcome:
        return self._inner.combine(signals, purpose)
