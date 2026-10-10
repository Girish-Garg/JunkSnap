"""The judge's structured answer (decision 20261011-0305): each attribute yes, no or uncertain."""

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from enum import StrEnum
from types import MappingProxyType


class TriState(StrEnum):
    YES = "yes"
    NO = "no"
    UNCERTAIN = "uncertain"

    @staticmethod
    def all_of(states: Iterable["TriState"]) -> "TriState":
        """No when any is no, yes when every one is yes, else uncertain."""
        found = set(states)
        if TriState.NO in found:
            return TriState.NO
        return TriState.YES if found == {TriState.YES} else TriState.UNCERTAIN

    @staticmethod
    def any_of(states: Iterable["TriState"]) -> "TriState":
        """Yes when any is yes, no when every one is no, else uncertain."""
        found = set(states)
        if TriState.YES in found:
            return TriState.YES
        return TriState.NO if found == {TriState.NO} else TriState.UNCERTAIN


class ClaimAnswer(StrEnum):
    """What the judge's answer says about one claim; the report rules act on it."""

    YES = "yes"
    NO = "no"  # a strong no: rejected unless a trained detector is sure
    UNCERTAIN = "uncertain"  # the reporter is asked whether they are sure
    UNUSABLE = "unusable"  # the photo cannot be judged: a retake
    NOT_JUDGED = "not_judged"  # no_bin is never judged from a photo


# What must be visible for each report type; no_bin is absent: never judged from a photo.
TYPE_EVIDENCE: Mapping[str, tuple[str, ...]] = MappingProxyType(
    {
        "overflowing_bin": ("bin", "bin_overflowing_or_broken"),
        "contaminated_water": ("water_contamination",),
        "open_construction": ("construction_debris",),
        "waste_dump": ("garbage",),
    }
)
WASTE_ATTRIBUTES = (
    "garbage", "bin_overflowing_or_broken", "water_contamination", "construction_debris",
)


@dataclass(frozen=True)
class JudgeAttributes:
    garbage: TriState
    bin: TriState
    bin_overflowing_or_broken: TriState
    water_contamination: TriState
    construction_debris: TriState
    burning: TriState
    photo_usable: TriState
    user_verdict: TriState  # does the photo support the reporter's claim
    user_verdict_confidence: float
    prompt: str  # the judge prompt's version, for the evidence

    def state(self, name: str) -> TriState:
        value = getattr(self, name)
        if not isinstance(value, TriState):
            raise KeyError(name)
        return value

    def shows(self, report_type: str) -> TriState:
        """Whether the photo shows this type: every attribute it needs is yes."""
        return TriState.all_of(self.state(name) for name in TYPE_EVIDENCE[report_type])

    def sees_no_waste(self) -> bool:
        return all(self.state(name) is TriState.NO for name in WASTE_ATTRIBUTES)

    def answer(self, evidence: TriState | None) -> ClaimAnswer:
        """The claim's answer from the user verdict and the attributes the claim needs.

        A "no" from either is a strong no; anything uncertain, the photo included, asks the
        reporter; only a usable photo with both "yes" is a yes.
        """
        if evidence is None:
            return ClaimAnswer.NOT_JUDGED
        if self.photo_usable is TriState.NO:
            return ClaimAnswer.UNUSABLE
        states = {self.user_verdict, evidence, self.photo_usable}
        if TriState.NO in states:
            return ClaimAnswer.NO
        return ClaimAnswer.UNCERTAIN if TriState.UNCERTAIN in states else ClaimAnswer.YES

    def to_contract(self) -> dict[str, object]:
        names = (*WASTE_ATTRIBUTES, "bin", "burning", "photo_usable", "user_verdict")
        states: dict[str, object] = {name: self.state(name).value for name in names}
        return {
            **states,
            "user_verdict_confidence": round(self.user_verdict_confidence, 4),
            "prompt": self.prompt,
        }
