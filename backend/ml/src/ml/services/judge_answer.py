"""The JSON answer every model must give the vision judge, validated with pydantic."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from agent.domain.verification import REPORT_CONTEXTS, JudgeVerdict

RATIONALE_MAX = 500

ReportTypeName = Literal[
    "waste_dump", "no_bin", "contaminated_water", "open_construction", "not_waste"
]
ContextName = Literal[
    "vacant_plot", "roadside", "drain", "other", "no_bin", "no_pickup", "stagnant", "sewage",
    "foam", "choked_drain", "uncovered_debris", "dusty_site",
]


class JudgeAnswer(BaseModel):
    """Report type, context, burning, readable brands, rationale and confidence. No counts."""

    model_config = ConfigDict(frozen=True, extra="ignore")

    report_type: ReportTypeName
    context: ContextName | None = None
    burning: bool
    readable_brands: tuple[str, ...] = Field(default=(), max_length=20)
    rationale: str
    confidence: float = Field(ge=0.0, le=1.0)

    def to_verdict(self) -> JudgeVerdict:
        """The domain verdict. A context that does not belong to the report type becomes null."""
        allowed = REPORT_CONTEXTS.get(self.report_type, frozenset())
        return JudgeVerdict(
            report_type=self.report_type,
            context=self.context if self.context in allowed else None,
            burning=self.burning,
            readable_brands=tuple(brand.strip() for brand in self.readable_brands if brand.strip()),
            rationale=self.rationale.strip()[:RATIONALE_MAX],
            confidence=self.confidence,
        )
