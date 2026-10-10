"""Verification purposes: does the photo show the reported waste, or is the site now clean."""

from abc import ABC, abstractmethod
from collections.abc import Mapping, Sequence
from types import MappingProxyType
from typing import override

from ml.domain.errors import InvalidClaimError
from ml.domain.verification import NOT_WASTE, Claim, JudgeVerdict, Outcome, Thresholds
from ml.domain.vetoes import REPORT_VETOES, VetoEvidence, VetoRule

# The judge saw waste of another type than reported: neither support nor denial.
OTHER_TYPE_SUPPORT = 0.5


class Purpose(ABC):
    """Strategy per verify-request `purpose`; add a purpose by adding a class."""

    name: str
    id_prefix: str
    media_folder: str
    requires_judge: bool
    reports_insights: bool

    @abstractmethod
    def support(self, waste_score: float) -> float:
        """Claim support from a 0..1 score that waste of the claimed type is visible."""

    @abstractmethod
    def judge_hint(self, claim: Claim) -> str:
        """Extra text for the judge's user prompt; empty keeps the judge blind to the claim."""

    @abstractmethod
    def judge_support(self, verdict: JudgeVerdict, claim: Claim) -> float:
        """Claim support from the judge's verdict."""

    @abstractmethod
    def outcome(
        self, probability: float, disagreement: bool, thresholds: Thresholds, judged: bool
    ) -> Outcome:
        """Decision per the verification_result contract."""

    @abstractmethod
    def review(self, outcome: Outcome, evidence: VetoEvidence) -> Outcome:
        """The combiner's outcome, or a rejection when a veto rule fires."""

    @staticmethod
    def named(name: str) -> "Purpose":
        purpose = PURPOSES.get(name)
        if purpose is None:
            raise InvalidClaimError(f"unknown purpose: {name}")
        return purpose


class ReportPurpose(Purpose):
    name = "report"
    id_prefix = "rpt"
    media_folder = "media/reports/"
    requires_judge = False
    reports_insights = True

    def __init__(self, vetoes: Sequence[VetoRule] = REPORT_VETOES) -> None:
        self._vetoes = tuple(vetoes)

    def support(self, waste_score: float) -> float:
        return waste_score

    @override
    def judge_hint(self, claim: Claim) -> str:
        return ""

    def judge_support(self, verdict: JudgeVerdict, claim: Claim) -> float:
        if verdict.report_type == claim.report_type:
            return verdict.confidence
        if verdict.report_type == NOT_WASTE:
            return 1.0 - verdict.confidence
        return OTHER_TYPE_SUPPORT

    @override
    def outcome(
        self, probability: float, disagreement: bool, thresholds: Thresholds, judged: bool
    ) -> Outcome:
        if disagreement or thresholds.is_unsure(probability):
            decision = "community_check"
        elif probability >= thresholds.auto_verify_min:
            decision = "auto_verified"
        else:
            decision = "rejected"
        return Outcome(probability, decision, disagreement, is_clean=None)

    @override
    def review(self, outcome: Outcome, evidence: VetoEvidence) -> Outcome:
        """A strong "no" wins over disagreement: the photo never reaches the map (issue 103)."""
        for rule in self._vetoes:
            veto = rule.check(evidence)
            if veto is not None:
                return outcome.vetoed(veto)
        return outcome


class CleanupPurpose(Purpose):
    """Cleanups are rare and close a site, so the judge always runs and must confirm."""

    name = "cleanup"
    id_prefix = "cln"
    media_folder = "media/cleanups/"
    requires_judge = True
    reports_insights = False  # the contract keeps insights null for cleanups

    def support(self, waste_score: float) -> float:
        return 1.0 - waste_score

    def judge_hint(self, claim: Claim) -> str:
        return (
            f"This is an after-cleanup photo of a site reported as {claim.report_type} "
            f"({claim.context}). Set scene_fits_site accordingly."
        )

    @override
    def judge_support(self, verdict: JudgeVerdict, claim: Claim) -> float:
        if verdict.report_type != NOT_WASTE:
            return 1.0 - verdict.confidence
        return verdict.confidence if verdict.scene_fits_site else 0.0

    def outcome(
        self, probability: float, disagreement: bool, thresholds: Thresholds, judged: bool
    ) -> Outcome:
        clean = judged and probability >= thresholds.auto_verify_min and not disagreement
        decision = "auto_verified" if clean else "rejected"
        return Outcome(probability, decision, disagreement, is_clean=clean)

    @override
    def review(self, outcome: Outcome, evidence: VetoEvidence) -> Outcome:
        """The judge must already confirm a cleanup, and its not_waste means clean."""
        return outcome


PURPOSES: Mapping[str, Purpose] = MappingProxyType(
    {"report": ReportPurpose(), "cleanup": CleanupPurpose()}
)
