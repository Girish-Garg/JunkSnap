"""Vetoes: a strong "no" rejects a report photo whatever the combiner says."""

from abc import ABC, abstractmethod
from dataclasses import dataclass

from ml.domain.verification import NOT_WASTE, JudgeVerdict, SignalResult, Thresholds, Veto

JUDGE_SIGNAL = "vision_judge"
# Claim support below this is a clear "no", from the judge or from a detector.
LOW_SUPPORT = 0.2


@dataclass(frozen=True)
class VetoEvidence:
    signals: tuple[SignalResult, ...]
    verdict: JudgeVerdict | None
    thresholds: Thresholds

    def judge(self) -> SignalResult | None:
        return next((s for s in self.signals if s.name == JUDGE_SIGNAL), None)

    def detectors(self) -> tuple[SignalResult, ...]:
        """Signals that saw the claim, judge left out."""
        return tuple(s for s in self.signals if s.name != JUDGE_SIGNAL and not s.neutral)


class VetoRule(ABC):
    @abstractmethod
    def check(self, evidence: VetoEvidence) -> Veto | None: ...


class JudgeDenies(VetoRule):
    """The judge answered not_waste, or gave the claimed type almost no support."""

    def __init__(self, low_support: float = LOW_SUPPORT) -> None:
        self._low = low_support

    def check(self, evidence: VetoEvidence) -> Veto | None:
        judge, verdict = evidence.judge(), evidence.verdict
        if judge is None or verdict is None:
            return None
        if verdict.report_type == NOT_WASTE:
            return Veto(f"judge_veto:{NOT_WASTE}", (judge,))
        if judge.score < self._low:
            return Veto("judge_veto:low_support", (judge,))
        return None


class DetectorsDenyJudgeUnsure(VetoRule):
    """Every detector saw no waste and the judge did not confirm it (or could not run)."""

    def __init__(self, no_waste_max: float = LOW_SUPPORT) -> None:
        self._max = no_waste_max

    def check(self, evidence: VetoEvidence) -> Veto | None:
        detectors = evidence.detectors()
        if not detectors or any(s.score >= self._max for s in detectors):
            return None
        judge = evidence.judge()
        if judge is not None and judge.score >= evidence.thresholds.auto_verify_min:
            return None
        sources = detectors if judge is None else (*detectors, judge)
        return Veto("detectors_veto:no_waste", sources)


REPORT_VETOES: tuple[VetoRule, ...] = (JudgeDenies(), DetectorsDenyJudgeUnsure())
