"""Stacked verification: signals first, the vision judge only when needed, then the combiner."""

import logging
from collections.abc import Sequence
from functools import reduce

from ml.domain.case import VerificationCase, VerificationResult
from ml.domain.errors import ExternalServiceError
from ml.domain.insights import Insights
from ml.domain.verification import SignalResult
from ml.ports.clock import Clock
from ml.ports.signal import Signal
from ml.services.combiner_base import Combiner
from ml.services.vision_judge import VisionJudge

logger = logging.getLogger(__name__)


class StackedVerifier:
    """Composite of the signals, the judge (only when unsure or split) and the combiner."""

    def __init__(
        self,
        signals: Sequence[Signal],
        judge: VisionJudge,
        combiner: Combiner,
        clock: Clock,
    ) -> None:
        self._signals = tuple(signals)
        self._judge = judge
        self._combiner = combiner
        self._clock = clock

    def verify(self, case: VerificationCase) -> VerificationResult:
        results = self._measured(case)
        needed = self._combiner.needs_judge(results, case.purpose)
        reading = self._judge.judge(case) if needed else None
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
            embedding_key=next((r.artifact_key for r in results if r.artifact_key), None),
            insights=self._insights(results),
        )
        self._log(result)
        return result

    def _measured(self, case: VerificationCase) -> list[SignalResult]:
        """Signals that failed are logged and left out; with none left the error stands."""
        results, errors = [], []
        for signal in self._signals:
            try:
                results.append(signal.measure(case))
            except ExternalServiceError as error:
                errors.append(error)
                logger.warning("signal_failed", extra={"fields": {"reason": str(error)}})
        if not results and errors:
            raise errors[0]
        return results

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
