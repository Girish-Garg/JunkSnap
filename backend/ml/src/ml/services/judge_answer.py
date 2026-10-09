"""The JSON answer every model must give the vision judge."""

from collections.abc import Mapping
from types import MappingProxyType
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ml.domain.insights import (
    HazardSighting,
    Insights,
    InsightSource,
    MaterialShare,
    SizeEstimate,
)
from ml.domain.verification import REPORT_CONTEXTS, JudgeVerdict

RATIONALE_MAX = 500

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


class HazardAnswer(BaseModel):
    model_config = ConfigDict(frozen=True, extra="ignore")

    hazard: HazardName
    confidence: float = Field(ge=0.0, le=1.0)


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
    hazards: tuple[HazardAnswer, ...] = Field(default=(), max_length=5)
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

    def to_insights(self, source: InsightSource) -> Insights:
        weights: dict[str, float] = {}
        for item in self.composition:
            weights[item.material] = weights.get(item.material, 0.0) + item.share
        size = None if self.size_class is None else SizeEstimate(self.size_class, source)
        return Insights(
            composition=MaterialShare.from_weights(weights, source),
            size_class=size,
            hazards=self._sightings(source),
            decides_burning=True,
        )

    @model_validator(mode="after")
    def _burning_is_listed(self) -> Self:
        # Every hazard confidence is the judge's own, so burning must also be a listed hazard.
        if self.burning != any(item.hazard == "burning" for item in self.hazards):
            raise ValueError("burning must match a burning entry in hazards")
        return self

    def _sightings(self, source: InsightSource) -> tuple[HazardSighting, ...]:
        found = {item.hazard: item.confidence for item in self.hazards}
        return tuple(HazardSighting(hazard, conf, source) for hazard, conf in found.items())


class CleanupJudgeAnswer(JudgeAnswer):
    """A cleanup answer without the scene check is invalid, so the router retries or moves on."""

    scene_fits_site: bool


ANSWER_SCHEMAS: Mapping[str, type[JudgeAnswer]] = MappingProxyType(
    {"report": JudgeAnswer, "cleanup": CleanupJudgeAnswer}
)
