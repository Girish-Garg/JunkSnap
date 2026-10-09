"""Stacked verification: signals first, the vision judge only when needed, then the combiner."""

import logging
from collections.abc import Sequence
from functools import reduce

from ml.domain.case import VerificationCase, VerificationResult
from ml.domain.insights import Insights
from ml.domain.verification import SignalResult
from ml.ports.clock import Clock
from ml.ports.signal import Signal
from ml.services.combiner import FixedWeightCombiner
from ml.services.vision_judge import VisionJudge

logger = logging.getLogger(__name__)


class StackedVerifier:
    """Composite of the signals, the judge (only when unsure or split) and the combiner."""

    def __init__(
        self,
        signals: Sequence[Signal],
        judge: VisionJudge,
        combiner: FixedWeightCombiner,
        clock: Clock,
    ) -> None:
        self._signals = tuple(signals)
        self._judge = judge
        self._combiner = combiner
        self._clock = clock

    def verify(self, case: VerificationCase) -> VerificationResult:
        results = [signal.measure(case) for signal in self._signals]
        reading = self._judge.judge(case) if self._combiner.needs_judge(results) else None
        if reading is not None:
            results.append(reading.signal)
        result = VerificationResult(
            case=case,
            outcome=self._combiner.combine(results, case.purpose),
            thresholds=self._combiner.thresholds,
            signals=tuple(results),
            judge=None if reading is None else reading.verdict,
            combiner=self._combiner.info(),
            decided_at=self._clock.now(),
            insights=self._insights(results),
        )
        self._log(result)
        return result

    @staticmethod
    def _insights(results: Sequence[SignalResult]) -> Insights:
        # Later results win on composition and size, so the judge does when it ran.
        return reduce(lambda total, r: total.merged_with(r.insights), results, Insights())

    def _log(self, result: VerificationResult) -> None:
        fields = {
            "report_id": result.case.report_id,
            "purpose": result.case.purpose.name,
            "probability": round(result.outcome.probability, 4),
            "decision": result.outcome.decision,
            "judge_ran": result.judge is not None,
            "signals": [f"{s.name}={s.score:.2f}" for s in result.signals],
        }
        logger.info("verified", extra={"fields": fields})
