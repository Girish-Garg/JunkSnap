"""Purpose of a verification: does the photo show the reported waste, or is the site clean?

Each purpose turns model evidence into support for its own claim and makes its own decision,
so the verifier has no `if purpose == ...` branches. Add a purpose by adding a class.
"""

from abc import ABC, abstractmethod
from collections.abc import Mapping
from types import MappingProxyType
from typing import override

from agent.domain.errors import InvalidClaimError
from agent.domain.verification import NOT_WASTE, Claim, JudgeVerdict, Outcome, Thresholds

# The judge saw waste of another type than reported: neither support nor denial.
OTHER_TYPE_SUPPORT = 0.5


class Purpose(ABC):
    """Strategy for one value of the verify request's `purpose`."""

    name: str
    id_prefix: str

    @abstractmethod
    def support(self, waste_score: float) -> float:
        """Turn a 0..1 score for 'waste of the claimed type is visible' into claim support."""

    @abstractmethod
    def judge_support(self, verdict: JudgeVerdict, claim: Claim) -> float:
        """Turn the judge's verdict into claim support."""

    @abstractmethod
    def outcome(self, probability: float, disagreement: bool, thresholds: Thresholds) -> Outcome:
        """Decision for this purpose, per the verification_result contract."""

    @staticmethod
    def named(name: str) -> "Purpose":
        purpose = PURPOSES.get(name)
        if purpose is None:
            raise InvalidClaimError(f"unknown purpose: {name}")
        return purpose


class ReportPurpose(Purpose):
    """Claim: the photo shows the reported waste. Disagreement always goes to the community."""

    name = "report"
    id_prefix = "rpt"

    def support(self, waste_score: float) -> float:
        return waste_score

    def judge_support(self, verdict: JudgeVerdict, claim: Claim) -> float:
        if verdict.report_type == claim.report_type:
            return verdict.confidence
        if verdict.report_type == NOT_WASTE:
            return 1.0 - verdict.confidence
        return OTHER_TYPE_SUPPORT

    def outcome(self, probability: float, disagreement: bool, thresholds: Thresholds) -> Outcome:
        if disagreement or thresholds.is_unsure(probability):
            decision = "community_check"
        elif probability >= thresholds.auto_verify_min:
            decision = "auto_verified"
        else:
            decision = "rejected"
        return Outcome(probability, decision, disagreement, is_clean=None)


class CleanupPurpose(Purpose):
    """Claim: the site in the after-photo is clean. Cleanups never go to community check."""

    name = "cleanup"
    id_prefix = "cln"

    def support(self, waste_score: float) -> float:
        return 1.0 - waste_score

    @override
    def judge_support(self, verdict: JudgeVerdict, claim: Claim) -> float:
        if verdict.report_type == NOT_WASTE:
            return verdict.confidence
        return 1.0 - verdict.confidence

    def outcome(self, probability: float, disagreement: bool, thresholds: Thresholds) -> Outcome:
        clean = probability >= thresholds.auto_verify_min and not disagreement
        decision = "auto_verified" if clean else "rejected"
        return Outcome(probability, decision, disagreement, is_clean=clean)


PURPOSES: Mapping[str, Purpose] = MappingProxyType(
    {"report": ReportPurpose(), "cleanup": CleanupPurpose()}
)
