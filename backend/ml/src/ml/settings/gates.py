"""Verification gates: the decision floors, disagreement, the report rules and the fixed weights."""

from typing import Self

from pydantic import Field, model_validator

from ml.domain.verification import Thresholds
from ml.domain.vetoes import VetoLimits
from ml.settings.base import Probability, TunableSettings, Weight


class GateSettings(TunableSettings):
    # Probability at or above this is auto-verified; from community_check_min, community check.
    auto_verify_min: Probability = Field(default=0.85, alias="ML_AUTO_VERIFY_MIN")
    community_check_min: Probability = Field(default=0.5, alias="ML_COMMUNITY_CHECK_MIN")
    # Two signal scores at least this far apart strongly disagree: community check.
    disagreement_gap: float = Field(
        default=0.5, gt=0.0, le=1.0, allow_inf_nan=False, alias="ML_DISAGREEMENT_GAP"
    )
    # YOLO at or above this lifts a judge "no" or an unusable photo to community check.
    yolo_lift_min: Probability = Field(default=0.5, alias="ML_YOLO_LIFT_MIN")
    # Every detector under this, and the judge under community_check_min: rejected.
    detectors_veto_max: Probability = Field(default=0.2, alias="ML_DETECTORS_VETO_MAX")
    # Fixed-weight combiner (fw-v0); the meta-learner's weights come from its model file.
    weight_rekognition_labels: Weight = Field(default=0.4, alias="ML_WEIGHT_REKOGNITION_LABELS")
    weight_yolo: Weight = Field(default=0.3, alias="ML_WEIGHT_YOLO")
    weight_embedding_classifier: Weight = Field(
        default=0.3, alias="ML_WEIGHT_EMBEDDING_CLASSIFIER"
    )
    # Above 0: the judge decides untrained types on these weights.
    weight_vision_judge: Weight = Field(default=0.6, gt=0.0, alias="ML_WEIGHT_VISION_JUDGE")

    @model_validator(mode="after")
    def _floors_in_order(self) -> Self:
        if self.community_check_min >= self.auto_verify_min:
            raise ValueError("ML_COMMUNITY_CHECK_MIN must be below ML_AUTO_VERIFY_MIN")
        return self

    def thresholds(self) -> Thresholds:
        return Thresholds(self.auto_verify_min, self.community_check_min)

    def veto_limits(self) -> VetoLimits:
        return VetoLimits(self.yolo_lift_min, self.detectors_veto_max)

    def fixed_weights(self) -> dict[str, float]:
        """Keyed by signal name, as the fixed-weight combiner reads them."""
        return {
            "rekognition_labels": self.weight_rekognition_labels,
            "yolo": self.weight_yolo,
            "embedding_classifier": self.weight_embedding_classifier,
            "vision_judge": self.weight_vision_judge,
        }
