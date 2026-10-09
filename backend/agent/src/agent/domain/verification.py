"""Value objects of stacked verification. Field names follow contracts/verification_result."""

from collections.abc import Mapping
from dataclasses import dataclass
from types import MappingProxyType

from agent.domain.errors import InvalidClaimError

REPORT_CONTEXTS: Mapping[str, frozenset[str]] = MappingProxyType(
    {
        "waste_dump": frozenset({"vacant_plot", "roadside", "drain", "other"}),
        "no_bin": frozenset({"no_bin", "no_pickup"}),
        "contaminated_water": frozenset({"stagnant", "sewage", "foam", "choked_drain"}),
        "open_construction": frozenset({"uncovered_debris", "dusty_site"}),
    }
)
NOT_WASTE = "not_waste"


@dataclass(frozen=True)
class Claim:
    """What the reporter says the photo shows: a report type and one of its contexts."""

    report_type: str
    context: str

    def __post_init__(self) -> None:
        if self.context not in REPORT_CONTEXTS.get(self.report_type, frozenset()):
            raise InvalidClaimError(f"{self.report_type}/{self.context} is not a contract pair")


@dataclass(frozen=True)
class CaseFeatures:
    """Non-model inputs to the combiner, passed through from the verify request."""

    gps_accuracy_m: float
    reputation: float
    nearby_verified_reports: int

    def to_contract(self) -> dict[str, object]:
        return {
            "gps_accuracy_m": self.gps_accuracy_m,
            "reputation": self.reputation,
            "nearby_verified_reports": self.nearby_verified_reports,
        }


@dataclass(frozen=True)
class SignalResult:
    """One model's support for the claim, with the provenance the evidence needs.

    `notes` are short human-readable reasons (matched labels) for logs and the CLI only.
    """

    name: str
    score: float
    provider: str
    model: str
    version: str
    latency_ms: int
    notes: tuple[str, ...] = ()

    def to_contract(self) -> dict[str, object]:
        return {
            "name": self.name,
            "score": round(self.score, 4),
            "provider": self.provider,
            "model": self.model,
            "version": self.version,
            "latency_ms": self.latency_ms,
        }


@dataclass(frozen=True)
class JudgeVerdict:
    """What the vision judge saw. Never counts or boxes."""

    report_type: str
    context: str | None
    burning: bool
    readable_brands: tuple[str, ...]
    rationale: str
    confidence: float

    def to_contract(self) -> dict[str, object]:
        return {
            "report_type": self.report_type,
            "context": self.context,
            "burning": self.burning,
            "readable_brands": list(self.readable_brands),
            "rationale": self.rationale,
        }


@dataclass(frozen=True)
class Thresholds:
    """0.85 and above is auto-verified, 0.5 up to 0.85 goes to community check."""

    auto_verify_min: float = 0.85
    community_check_min: float = 0.5

    def is_unsure(self, probability: float) -> bool:
        return self.community_check_min <= probability < self.auto_verify_min

    def to_contract(self) -> dict[str, object]:
        return {
            "auto_verify_min": self.auto_verify_min,
            "community_check_min": self.community_check_min,
        }


@dataclass(frozen=True)
class Outcome:
    """The combiner's answer: probability, decision, disagreement and the cleanup judgement."""

    probability: float
    decision: str
    disagreement: bool
    is_clean: bool | None
