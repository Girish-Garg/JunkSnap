"""The JSON answer every model must give the vision judge."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from ml.domain.insights import Insights, MaterialShare
from ml.domain.verification import REPORT_CONTEXTS, JudgeVerdict

RATIONALE_MAX = 500
SOURCE = "vision_judge"

ReportTypeName = Literal[
    "waste_dump", "no_bin", "contaminated_water", "open_construction", "not_waste"
]
ContextName = Literal[
    "vacant_plot", "roadside", "drain", "other", "no_bin", "no_pickup", "stagnant", "sewage",
    "foam", "choked_drain", "uncovered_debris", "dusty_site",
]
MaterialName = Literal[
    "plastic", "organic", "construction_debris", "paper", "glass", "metal", "textile",
    "e_waste", "medical",
]
HazardName = Literal["burning", "medical_waste", "e_waste", "dead_animal", "chemicals"]


class MaterialAnswer(BaseModel):
    model_config = ConfigDict(frozen=True, extra="ignore")

    material: MaterialName
    share: float = Field(ge=0.0, le=1.0)


class JudgeAnswer(BaseModel):
    model_config = ConfigDict(frozen=True, extra="ignore")

    report_type: ReportTypeName
    context: ContextName | None = None
    burning: bool
    readable_brands: tuple[str, ...] = Field(default=(), max_length=20)
    rationale: str
    confidence: float = Field(ge=0.0, le=1.0)
    composition: tuple[MaterialAnswer, ...] = Field(default=(), max_length=9)
    size_class: Literal["small", "medium", "large"] | None = None
    hazards: tuple[HazardName, ...] = ()
    scene_fits_site: bool | None = None

    def to_verdict(self) -> JudgeVerdict:
        """A context that does not belong to the report type becomes null."""
        allowed = REPORT_CONTEXTS.get(self.report_type, frozenset())
        return JudgeVerdict(
            report_type=self.report_type,
            context=self.context if self.context in allowed else None,
            burning=self.burning,
            readable_brands=tuple(brand.strip() for brand in self.readable_brands if brand.strip()),
            rationale=self.rationale.strip()[:RATIONALE_MAX],
            confidence=self.confidence,
            scene_fits_site=self.scene_fits_site,
        )

    def to_insights(self) -> Insights:
        weights: dict[str, float] = {}
        for item in self.composition:
            weights[item.material] = weights.get(item.material, 0.0) + item.share
        return Insights(
            composition=MaterialShare.normalized(weights, SOURCE),
            size_class=self.size_class,
            hazards=frozenset(self.hazards) - {"burning"},
            burning=self.burning,  # the burning field decides, so judge and insights agree
        )
