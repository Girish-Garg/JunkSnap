"""Detector settings: YOLO boxes, the embedding head and Rekognition labels, and insight floors."""

from typing import Self

from pydantic import Field, model_validator

from ml.settings.base import Probability, TunableSettings


class SignalSettings(TunableSettings):
    # YOLO boxes under this are dropped; meta-v2 was fitted on scores read at 0.25.
    yolo_min_confidence: Probability = Field(default=0.25, alias="ML_YOLO_MIN_CONFIDENCE")
    yolo_hazard_min: Probability = Field(default=0.5, alias="ML_YOLO_HAZARD_MIN")
    # Boxes this sure count toward the size class; the bands are shares of the image.
    yolo_size_box_min: Probability = Field(default=0.4, alias="ML_YOLO_SIZE_BOX_MIN")
    yolo_size_small_max: Probability = Field(default=0.10, alias="ML_YOLO_SIZE_SMALL_MAX")
    yolo_size_medium_max: Probability = Field(default=0.35, alias="ML_YOLO_SIZE_MEDIUM_MAX")
    # Overflowing bin: waste within this many of the bin's longer sides is near it.
    yolo_bin_reach: float = Field(
        default=0.5, ge=0.0, le=5.0, allow_inf_nan=False, alias="ML_YOLO_BIN_REACH"
    )
    yolo_bin_alone_weight: Probability = Field(default=0.5, alias="ML_YOLO_BIN_ALONE_WEIGHT")
    embedding_hazard_min: Probability = Field(default=0.5, alias="ML_EMBEDDING_HAZARD_MIN")
    label_hazard_min: Probability = Field(default=0.6, alias="ML_LABEL_HAZARD_MIN")
    label_weak_weight: Probability = Field(default=0.6, alias="ML_LABEL_WEAK_WEIGHT")
    # The DetectLabels query; meta-v2 was fitted on labels asked for with these values.
    rekognition_max_labels: int = Field(
        default=50, ge=1, le=1000, alias="ML_REKOGNITION_MAX_LABELS"
    )
    rekognition_min_confidence: Probability = Field(
        default=0.5, alias="ML_REKOGNITION_MIN_CONFIDENCE"
    )

    @model_validator(mode="after")
    def _size_bands_in_order(self) -> Self:
        if self.yolo_size_small_max >= self.yolo_size_medium_max:
            raise ValueError("ML_YOLO_SIZE_SMALL_MAX must be below ML_YOLO_SIZE_MEDIUM_MAX")
        return self
