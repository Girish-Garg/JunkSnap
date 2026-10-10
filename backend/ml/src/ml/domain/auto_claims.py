"""Auto claims (contracts v1.10): scan frames whose place, or type and place, the judge names."""

from dataclasses import dataclass
from typing import override

from ml.domain.errors import InvalidClaimError
from ml.domain.verification import REPORT_CONTEXTS, Claim

AUTO = "auto"
# What an area scout can find by itself; no_bin needs a person to assert it.
SCOUT_TYPES = frozenset(
    {"waste_dump", "overflowing_bin", "contaminated_water", "open_construction"}
)


@dataclass(frozen=True)
class AutoContextClaim(Claim):
    """The person picked the type; the judge always runs and names the place."""

    @override
    def __post_init__(self) -> None:
        if self.context != AUTO or self.report_type not in SCOUT_TYPES:
            pair = f"{self.report_type}/{self.context}"
            raise InvalidClaimError(f"{pair} is not an auto-context pair")

    @property
    @override
    def judge_required(self) -> bool:
        return True


@dataclass(frozen=True)
class ScoutClaim(Claim):
    """Area scout: any waste the models can find supports it; not_waste and no_bin deny it."""

    @override
    def __post_init__(self) -> None:
        if (self.report_type, self.context) != (AUTO, AUTO):
            raise InvalidClaimError(f"{self.report_type}/{self.context} is not an area scout claim")

    @property
    @override
    def judge_required(self) -> bool:
        return True

    @override
    def matches(self, report_type: str) -> bool:
        return report_type in SCOUT_TYPES

    @override
    def denies(self, report_type: str) -> bool:
        return report_type not in SCOUT_TYPES


def claim_for(report_type: str, context: str) -> Claim:
    """The claim class for a verify request's type and context; raises InvalidClaimError."""
    if report_type == AUTO:
        return ScoutClaim(report_type, context)
    if context == AUTO and report_type in REPORT_CONTEXTS:
        return AutoContextClaim(report_type, context)
    return Claim(report_type, context)
