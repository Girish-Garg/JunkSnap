"""Stacked verification: signals first, the vision judge only when needed, then the combiner."""

import logging
from collections.abc import Sequence

from agent.domain.case import VerificationCase, VerificationResult
from agent.ports.clock import Clock
from agent.ports.signal import Signal
from agent.services.combiner import FixedWeightCombiner
from agent.services.vision_judge import VisionJudge

logger = logging.getLogger(__name__)


class StackedVerifier:
    """Composite of the signals, the judge and the combiner.

    1. Every signal measures the blurred photo (Rekognition now; YOLO and embeddings in A2).
    2. The judge runs only when the combiner finds the signals unsure or split (decision 0137).
    3. The combiner turns all scores into probability, decision and disagreement.
    """

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
        outcome = self._combiner.combine(results, case.purpose)
        result = VerificationResult(
            case=case,
            outcome=outcome,
            thresholds=self._combiner.thresholds,
            signals=tuple(results),
            judge=None if reading is None else reading.verdict,
            combiner=self._combiner.info(),
            decided_at=self._clock.now(),
        )
        self._log(result)
        return result

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
