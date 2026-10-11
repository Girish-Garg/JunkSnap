"""The JSON answer every model must give the vision judge (prompt judge_v1, decision 0305).

Each attribute is "yes", "no" or "uncertain". A missing or unreadable attribute, user verdict
or context falls back to "uncertain" (or null), which never verifies and never rejects: the
reporter is asked instead. The old single-type fields are derived from the attributes.
"""

import math
import re
from collections.abc import Mapping
from types import MappingProxyType
from typing import Annotated, Any, Literal, get_args

from pydantic import AliasChoices, BaseModel, BeforeValidator, ConfigDict, Field, model_validator

from ml.domain.insights import (
    HazardSighting,
    Insights,
    InsightSource,
    MaterialShare,
    SizeEstimate,
)
from ml.domain.judge_attributes import TYPE_EVIDENCE, JudgeAttributes, TriState
from ml.domain.verification import NOT_WASTE, REPORT_CONTEXTS, JudgeVerdict
from ml.services.judge_fields import JudgeInsightFields

RATIONALE_MAX = 500
UNSURE_CONFIDENCE = 0.5
PROMPT_VERSION = "judge_v1"
TRUTHY, FALSY = frozenset({"yes", "true", "y"}), frozenset({"no", "false", "n"})
CONTROL = re.compile(r"[\x00-\x1f\x7f]+")
# An answer must judge at least one of these, or it is no answer at all.
JUDGED_FIELDS = frozenset(
    {"user_verdict", "photo_usable", "garbage", "bin", "bin_overflowing_or_broken",
     "water_contamination", "construction_debris"}
)

ContextName = Literal[
    "vacant_plot", "roadside", "drain", "other", "no_bin", "no_pickup", "stagnant", "sewage",
    "foam", "choked_drain", "uncovered_debris", "dusty_site", "overflowing", "damaged",
]
CONTEXT_NAMES: frozenset[str] = frozenset(get_args(ContextName))
MaterialName = Literal[
    "plastic", "organic", "construction_debris", "paper", "glass", "metal", "textile",
    "e_waste", "medical",
]
HazardName = Literal["burning", "medical_waste", "e_waste", "dead_animal", "chemicals"]
SizeName = Literal["small", "medium", "large"]


def tri_state(value: object) -> TriState:
    """yes or no as given (booleans too); anything else, or nothing, is uncertain."""
    if isinstance(value, bool):
        return TriState.YES if value else TriState.NO
    text = value.strip().lower() if isinstance(value, str) else ""
    if text in TRUTHY:
        return TriState.YES
    return TriState.NO if text in FALSY else TriState.UNCERTAIN


def stated(value: object) -> TriState | None:
    """Burning only: None when the judge said nothing (no key, null, a number), else its state."""
    return tri_state(value) if isinstance(value, str | bool) else None


def unit_number(value: object) -> float:
    """A number clamped to 0..1; anything unreadable is 0.5, an unsure answer."""
    try:
        number = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return UNSURE_CONFIDENCE
    return UNSURE_CONFIDENCE if math.isnan(number) else min(1.0, max(0.0, number))


def known_context(value: object) -> str | None:
    return value if isinstance(value, str) and value in CONTEXT_NAMES else None


def plain_text(value: object) -> str:
    """One line: control characters out, whitespace collapsed, at most RATIONALE_MAX long."""
    text = CONTROL.sub(" ", value) if isinstance(value, str) else ""
    return " ".join(text.split())[:RATIONALE_MAX]


Tri = Annotated[TriState, BeforeValidator(tri_state)]


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

    garbage: Tri = TriState.UNCERTAIN
    bin: Tri = TriState.UNCERTAIN
    bin_overflowing_or_broken: Tri = TriState.UNCERTAIN
    water_contamination: Tri = TriState.UNCERTAIN
    construction_debris: Tri = TriState.UNCERTAIN
    # None: the judge said nothing, which decides no burning (judge_v1's examples omit it).
    burning: Annotated[TriState | None, BeforeValidator(stated)] = None
    photo_usable: Tri = TriState.UNCERTAIN
    context: Annotated[str | None, BeforeValidator(known_context)] = None
    user_verdict: Tri = TriState.UNCERTAIN
    user_verdict_confidence: Annotated[float, BeforeValidator(unit_number)] = UNSURE_CONFIDENCE
    reasoning: Annotated[str, BeforeValidator(plain_text)] = Field(
        default="", validation_alias=AliasChoices("reasoning", "rationale")
    )
    # Insight fields are read leniently (judge_fields): a bad item is dropped, not the answer.
    readable_brands: Annotated[tuple[str, ...], BeforeValidator(JudgeInsightFields.brands)] = ()
    composition: Annotated[
        tuple[MaterialAnswer, ...], BeforeValidator(JudgeInsightFields.composition)
    ] = ()
    size_class: Annotated[SizeName | None, BeforeValidator(JudgeInsightFields.size_class)] = None
    hazards: Annotated[tuple[HazardAnswer, ...], BeforeValidator(JudgeInsightFields.hazards)] = ()
    scene_fits_site: bool | None = None

    def attributes(self, prompt: str = PROMPT_VERSION) -> JudgeAttributes:
        return JudgeAttributes(
            garbage=self.garbage, bin=self.bin,
            bin_overflowing_or_broken=self.bin_overflowing_or_broken,
            water_contamination=self.water_contamination,
            construction_debris=self.construction_debris,
            burning=self.burning or TriState.UNCERTAIN,
            photo_usable=self.photo_usable, user_verdict=self.user_verdict,
            user_verdict_confidence=self.user_verdict_confidence, prompt=prompt,
        )

    def to_verdict(self, prompt: str = PROMPT_VERSION) -> JudgeVerdict:
        """The old single-type fields, derived; a context of another type becomes null."""
        found = self.attributes(prompt)
        report_type = self._shown_type(found)
        allowed = REPORT_CONTEXTS.get(report_type, frozenset())
        return JudgeVerdict(
            report_type=report_type,
            context=self.context if self.context in allowed else None,
            burning=found.burning is TriState.YES,
            readable_brands=self.readable_brands,
            rationale=self.reasoning,
            confidence=self.user_verdict_confidence,
            scene_fits_site=self.scene_fits_site,
            attributes=found,
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
            # An answer of uncertain keeps the detectors' burning; yes, no or silence replaces it.
            decides_burning=self.burning is not TriState.UNCERTAIN,
        )

    @model_validator(mode="before")
    @classmethod
    def _normalised(cls, raw: Any) -> Any:
        """An object that judges nothing is no answer; the router moves to the next model.

        Every hazard confidence is the judge's own: a burning hazard at HAZARD_MIN or more
        means burning yes; a weaker one is dropped and never overrides a "no". Burning "yes"
        without such a hazard has no confidence, so it becomes uncertain.
        """
        if not isinstance(raw, dict) or not JUDGED_FIELDS & raw.keys():
            raise ValueError("not a structured judge answer")
        if "burning" in JudgeInsightFields.sure(raw.get("hazards")):
            return {**raw, "burning": "yes"}
        if tri_state(raw.get("burning")) is TriState.YES:
            return {**raw, "burning": "uncertain"}
        return raw

    def _shown_type(self, found: JudgeAttributes) -> str:
        """The type the judge's context names when the photo shows it, else the first shown."""
        named = next((kind for kind, allowed in REPORT_CONTEXTS.items()
                      if self.context in allowed and kind in TYPE_EVIDENCE), None)
        order = ((named,) if named else ()) + tuple(TYPE_EVIDENCE)
        return next((kind for kind in order if found.shows(kind) is TriState.YES), NOT_WASTE)

    def _sightings(self, source: InsightSource) -> tuple[HazardSighting, ...]:
        found = {item.hazard: item.confidence for item in self.hazards}
        return tuple(HazardSighting(hazard, conf, source) for hazard, conf in found.items())


class CleanupJudgeAnswer(JudgeAnswer):
    """A cleanup answer without the scene check is invalid, so the router retries or moves on."""

    scene_fits_site: bool


ANSWER_SCHEMAS: Mapping[str, type[JudgeAnswer]] = MappingProxyType(
    {"report": JudgeAnswer, "cleanup": CleanupJudgeAnswer}
)
