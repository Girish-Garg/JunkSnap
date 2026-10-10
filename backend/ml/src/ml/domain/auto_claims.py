"""Auto claims (contracts v1.10): scan frames whose place, or type and place, the judge names."""

from dataclasses import dataclass
from typing import override

from ml.domain.errors import InvalidClaimError
from ml.domain.judge_attributes import JudgeAttributes, TriState
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

    @override
    def describe(self) -> str:
        return f"{self.report_type} (any context; name the context you see)"


@dataclass(frozen=True)
class ScoutClaim(Claim):
    """Area scout: any waste the models can find supports it; a photo showing none denies it."""

    @override
    def __post_init__(self) -> None:
        if (self.report_type, self.context) != (AUTO, AUTO):
            raise InvalidClaimError(f"{self.report_type}/{self.context} is not an area scout claim")

    @property
    @override
    def judge_required(self) -> bool:
        return True

    @override
    def describe(self) -> str:
        return f"any of {', '.join(sorted(SCOUT_TYPES))} (name the type and context you see)"

    @override
    def evidence(self, attributes: JudgeAttributes) -> TriState:
        return TriState.any_of(attributes.shows(kind) for kind in SCOUT_TYPES)


def claim_for(report_type: str, context: str) -> Claim:
    """The claim class for a verify request's type and context; raises InvalidClaimError."""
    if report_type == AUTO:
        return ScoutClaim(report_type, context)
    if context == AUTO and report_type in REPORT_CONTEXTS:
        return AutoContextClaim(report_type, context)
    return Claim(report_type, context)
