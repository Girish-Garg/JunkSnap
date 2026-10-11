"""Judge rules: they set a report photo's decision whatever the combiner says.

Decision 0230 made a strong judge "no" reject; decision 0305 reads the judge's structured
answer: a "no" or an unusable photo goes to neighbours when a trained detector is sure, and
an uncertain answer asks the reporter to confirm.
"""

from abc import ABC, abstractmethod
from collections.abc import Iterable
from dataclasses import dataclass
from typing import override

from ml.domain.judge_attributes import ClaimAnswer
from ml.domain.verification import (
    JudgeVerdict,
    Outcome,
    SignalResult,
    Thresholds,
    Veto,
)

JUDGE_SIGNAL = "vision_judge"
# Claim support below this is a clear "no" from every detector.
LOW_SUPPORT = 0.2  # ML_DETECTORS_VETO_MAX
# A trained detector at or above this is sure it sees waste.
DETECTOR_SURE = 0.5  # ML_YOLO_LIFT_MIN
# Only our trained object detector can lift a judge "no" or an unusable photo. Rekognition's
# generic labels see waste in clean streets, and the embedding head gave 0.77 to the prod
# indoor-cupboard photo the judge rightly called not_waste (decision 20261011-0305).
TRAINED_DETECTORS = frozenset({"yolo"})
JUDGE_VETO = "judge_veto"
COMBINED_NO_REASON = "combined_no"
REJECTED, COMMUNITY_CHECK, NEEDS_CONFIRMATION = "rejected", "community_check", "needs_confirmation"


@dataclass(frozen=True)
class VetoEvidence:
    signals: tuple[SignalResult, ...]
    verdict: JudgeVerdict | None
    thresholds: Thresholds
    outcome: Outcome | None = None  # the combiner's, before any rule
    answer: ClaimAnswer | None = None  # the judge's answer to the claim; None without a judge

    def judge(self) -> SignalResult | None:
        return next((s for s in self.signals if s.name == JUDGE_SIGNAL), None)

    def detectors(self) -> tuple[SignalResult, ...]:
        """Signals that saw the claim, judge left out."""
        return tuple(s for s in self.signals if s.name != JUDGE_SIGNAL and not s.neutral)


class VetoRule(ABC):
    @abstractmethod
    def check(self, evidence: VetoEvidence) -> Veto | None: ...


class SureDetectors:
    """The trained detectors that saw the claim and are sure waste is there."""

    def __init__(self, names: Iterable[str] = TRAINED_DETECTORS, sure: float = DETECTOR_SURE):
        self._names = frozenset(names)
        self._sure = sure

    def of(self, evidence: VetoEvidence) -> tuple[SignalResult, ...]:
        return tuple(
            s for s in evidence.detectors() if s.name in self._names and s.score >= self._sure
        )


class JudgeOverruledBySureDetectors(VetoRule):
    """The judge's answer rejects the photo, unless a trained detector is sure: then neighbours."""

    def __init__(self, answer: ClaimAnswer, overruled: str, sure: SureDetectors | None = None):
        self._answer = answer
        self._overruled = overruled
        self._sure = sure or SureDetectors()

    def check(self, evidence: VetoEvidence) -> Veto | None:
        judge, verdict = evidence.judge(), evidence.verdict
        if judge is None or verdict is None or evidence.answer is not self._answer:
            return None
        sure = self._sure.of(evidence)
        if sure:
            return Veto(self._overruled, (judge, *sure), COMMUNITY_CHECK)
        return Veto(f"{JUDGE_VETO}:{self._reason(verdict)}", (judge,))

    @abstractmethod
    def _reason(self, verdict: JudgeVerdict) -> str: ...


class JudgeUnusable(JudgeOverruledBySureDetectors):
    """photo_usable no: the reporter retakes the photo (`judge_veto:unclear`)."""

    def __init__(self, sure: SureDetectors | None = None) -> None:
        super().__init__(ClaimAnswer.UNUSABLE, "judge_unclear:detector_yes", sure)

    @override
    def _reason(self, verdict: JudgeVerdict) -> str:
        return "unclear"  # whatever the answer, the photo could not be judged


class JudgeSaysNo(JudgeOverruledBySureDetectors):
    """user_verdict no, or a needed attribute no: a strong no.

    not_waste when the judge saw no waste of any kind, else low_support (another kind of waste,
    or a clean bin for an overflowing_bin claim).
    """

    def __init__(self, sure: SureDetectors | None = None) -> None:
        super().__init__(ClaimAnswer.NO, "judge_no:detector_yes", sure)

    @override
    def _reason(self, verdict: JudgeVerdict) -> str:
        return "not_waste" if verdict.attributes.sees_no_waste() else "low_support"


class JudgeUnsure(VetoRule):
    """An uncertain answer neither verifies nor rejects: the reporter is asked if they are sure."""

    def check(self, evidence: VetoEvidence) -> Veto | None:
        judge = evidence.judge()
        if judge is None or evidence.answer is not ClaimAnswer.UNCERTAIN:
            return None
        return Veto("judge_unsure:ask_reporter", (judge,), NEEDS_CONFIRMATION)


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

    The structured rules above settle a judge "no" first; this stays as the last guard for a
    judge support under community_check_min that no rule above settled.
    """

    def check(self, evidence: VetoEvidence) -> Veto | None:
        judge, outcome = evidence.judge(), evidence.outcome
        if judge is None or outcome is None or not outcome.disagreement:
            return None
        bar = evidence.thresholds.community_check_min
        if outcome.probability >= bar or judge.score >= bar:
            return None
        return Veto(f"{JUDGE_VETO}:{COMBINED_NO_REASON}", (judge,))


@dataclass(frozen=True)
class VetoLimits:
    """The report rules' numbers (ML_YOLO_LIFT_MIN, ML_DETECTORS_VETO_MAX); rules() orders them."""

    detector_sure: float = DETECTOR_SURE
    no_waste_max: float = LOW_SUPPORT

    def rules(self) -> tuple[VetoRule, ...]:
        """First match wins."""
        sure = SureDetectors(TRAINED_DETECTORS, self.detector_sure)
        return (
            JudgeUnusable(sure),
            JudgeSaysNo(sure),
            JudgeUnsure(),
            DetectorsDenyJudgeUnsure(self.no_waste_max),
            JudgeAndCombinerSayNo(),
        )


REPORT_VETOES: tuple[VetoRule, ...] = VetoLimits().rules()
