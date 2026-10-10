"""Value objects of stacked verification; field names follow contracts/verification_result."""

from collections.abc import Mapping
from dataclasses import dataclass, field
from types import MappingProxyType

from ml.domain.errors import InvalidClaimError
from ml.domain.insights import Insights
from ml.domain.judge_attributes import TYPE_EVIDENCE, ClaimAnswer, JudgeAttributes, TriState

REPORT_CONTEXTS: Mapping[str, frozenset[str]] = MappingProxyType(
    {
        "waste_dump": frozenset({"vacant_plot", "roadside", "drain", "other"}),
        "no_bin": frozenset({"no_bin", "no_pickup"}),
        "contaminated_water": frozenset({"stagnant", "sewage", "foam", "choked_drain"}),
        "open_construction": frozenset({"uncovered_debris", "dusty_site"}),
        "overflowing_bin": frozenset({"overflowing", "damaged"}),
    }
)
NOT_WASTE = "not_waste"


@dataclass(frozen=True)
class Claim:
    report_type: str
    context: str

    def __post_init__(self) -> None:
        if self.context not in REPORT_CONTEXTS.get(self.report_type, frozenset()):
            raise InvalidClaimError(f"{self.report_type}/{self.context} is not a contract pair")

    @property
    def judge_required(self) -> bool:
        """True when the judge must name part of the claim, so it runs on every case."""
        return False

    def describe(self) -> str:
        """The claim as the judge's user prompt states it."""
        return f"{self.report_type} ({self.context})"

    def evidence(self, attributes: JudgeAttributes) -> TriState | None:
        """Whether the photo shows the claimed type; None for a type never judged from a photo."""
        if self.report_type not in TYPE_EVIDENCE:
            return None
        return attributes.shows(self.report_type)


@dataclass(frozen=True)
class CaseFeatures:
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
    """One model's support for the claim (0..1); notes and insights stay out of the signal entry."""

    name: str
    score: float
    provider: str
    model: str
    version: str
    latency_ms: int
    notes: tuple[str, ...] = ()
    insights: Insights = field(default_factory=Insights)
    artifact_key: str | None = None  # the stored embedding, for SiteMerger
    neutral: bool = False  # the model cannot see this claim, so its score carries no evidence

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
    report_type: str
    context: str | None
    burning: bool
    readable_brands: tuple[str, ...]
    rationale: str
    confidence: float
    scene_fits_site: bool | None  # cleanups only: an outdoor place fit for the site
    attributes: JudgeAttributes  # the structured answer the fields above derive from

    @property
    def unclear(self) -> bool:
        """The photo cannot be judged (too blurry, dark or close): a retake."""
        return self.attributes.photo_usable is TriState.NO

    def answer_for(self, claim: Claim) -> ClaimAnswer:
        return self.attributes.answer(claim.evidence(self.attributes))

    def to_contract(self) -> dict[str, object]:
        return {
            "report_type": self.report_type,
            "context": self.context,
            "burning": self.burning,
            "readable_brands": list(self.readable_brands),
            "rationale": self.rationale,
            "attributes": self.attributes.to_contract(),
        }


@dataclass(frozen=True)
class Thresholds:
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
class Veto:
    """A judge rule that set the decision whatever the combiner said, and its models.

    Most reject the photo; since decision 0305 a rule can also send it to community check or
    ask the reporter to confirm.
    """

    reason: str  # for example judge_veto:not_waste or judge_unsure:ask_reporter
    sources: tuple[SignalResult, ...]
    decision: str = "rejected"  # or community_check, or needs_confirmation (decision 0305)

    def label(self) -> str:
        """The reason with each model's provider, model and version, for the evidence."""
        models = ",".join(f"{s.provider}/{s.model}@{s.version}" for s in self.sources)
        return f"{self.reason} by {models}"


@dataclass(frozen=True)
class Outcome:
    probability: float
    decision: str
    disagreement: bool
    is_clean: bool | None
    veto: Veto | None = None

    def vetoed(self, veto: Veto) -> "Outcome":
        return Outcome(self.probability, veto.decision, self.disagreement, self.is_clean, veto)
