"""Vetoes: a strong "no" rejects a report photo whatever the combiner says (decision 0230)."""

from abc import ABC, abstractmethod
from dataclasses import dataclass

from ml.domain.verification import (
    NOT_WASTE,
    JudgeVerdict,
    Outcome,
    SignalResult,
    Thresholds,
    Veto,
)

JUDGE_SIGNAL = "vision_judge"
# Claim support below this is a clear "no", from the judge or from a detector.
LOW_SUPPORT = 0.2
JUDGE_VETO = "judge_veto"
UNCLEAR = "unclear"
LOW_SUPPORT_REASON = "low_support"
COMBINED_NO_REASON = "combined_no"


@dataclass(frozen=True)
class VetoEvidence:
    signals: tuple[SignalResult, ...]
    verdict: JudgeVerdict | None
    thresholds: Thresholds
    outcome: Outcome | None = None  # the combiner's, before any veto

    def judge(self) -> SignalResult | None:
        return next((s for s in self.signals if s.name == JUDGE_SIGNAL), None)

    def detectors(self) -> tuple[SignalResult, ...]:
        """Signals that saw the claim, judge left out."""
        return tuple(s for s in self.signals if s.name != JUDGE_SIGNAL and not s.neutral)


class VetoRule(ABC):
    @abstractmethod
    def check(self, evidence: VetoEvidence) -> Veto | None: ...


class JudgeUnclear(VetoRule):
    """The judge says the photo is unusable (too blurry, dark or close): the reporter retakes it."""

    def check(self, evidence: VetoEvidence) -> Veto | None:
        judge, verdict = evidence.judge(), evidence.verdict
        if judge is None or verdict is None or not verdict.unclear:
            return None
        return Veto(f"{JUDGE_VETO}:{UNCLEAR}", (judge,))


class JudgeDenies(VetoRule):
    """A strong judge "no": claim support under 0.2, whatever type it named (decision 0230).

    not_waste keeps its own reason for the app; any other answer (the claimed type at low
    confidence, no_bin for a scout) is low_support. Another waste type has support 0.5.
    """

    def __init__(self, low_support: float = LOW_SUPPORT) -> None:
        self._low = low_support

    def check(self, evidence: VetoEvidence) -> Veto | None:
        judge, verdict = evidence.judge(), evidence.verdict
        if judge is None or verdict is None or judge.score >= self._low:
            return None
        reason = NOT_WASTE if verdict.report_type == NOT_WASTE else LOW_SUPPORT_REASON
        return Veto(f"{JUDGE_VETO}:{reason}", (judge,))


class DetectorsDenyJudgeUnsure(VetoRule):
    """Every detector saw no waste; the judge is under community_check_min or could not run."""

    def __init__(self, no_waste_max: float = LOW_SUPPORT) -> None:
        self._max = no_waste_max

    def check(self, evidence: VetoEvidence) -> Veto | None:
        detectors = evidence.detectors()
        if not detectors or any(s.score >= self._max for s in detectors):
            return None
        judge = evidence.judge()
        if judge is not None and judge.score >= evidence.thresholds.community_check_min:
            return None
        sources = detectors if judge is None else (*detectors, judge)
        return Veto("detectors_veto:no_waste", sources)


class JudgeAndCombinerSayNo(VetoRule):
    """Disagreement never lifts a "no" into community_check when the judge is the one saying no.

    The judge runs on every report, so a judge "no" against one detector's "yes" is common;
    with the combined probability also under community_check_min the photo is rejected.
    """

    def check(self, evidence: VetoEvidence) -> Veto | None:
        judge, outcome = evidence.judge(), evidence.outcome
        if judge is None or outcome is None or not outcome.disagreement:
            return None
        bar = evidence.thresholds.community_check_min
        if outcome.probability >= bar or judge.score >= bar:
            return None
        return Veto(f"{JUDGE_VETO}:{COMBINED_NO_REASON}", (judge,))


REPORT_VETOES: tuple[VetoRule, ...] = (
    JudgeUnclear(),
    JudgeDenies(),
    DetectorsDenyJudgeUnsure(),
    JudgeAndCombinerSayNo(),
)
