"""LabelDetector over Rekognition DetectLabels."""

import time
from typing import TYPE_CHECKING

from botocore.exceptions import BotoCoreError, ClientError

from ml.domain.errors import ExternalServiceError
from ml.domain.images import BlurredImage
from ml.domain.labels import DetectedLabel, LabelSet
from ml.ports.label_detector import LabelDetector

if TYPE_CHECKING:
    from mypy_boto3_rekognition import RekognitionClient

MODEL = "DetectLabels"
MAX_LABELS = 50  # ML_REKOGNITION_MAX_LABELS
MIN_CONFIDENCE = 0.5  # ML_REKOGNITION_MIN_CONFIDENCE, 0..1
PERCENT = 100  # Rekognition's confidence unit


class RekognitionLabelDetector(LabelDetector):
    def __init__(
        self,
        client: "RekognitionClient",
        max_labels: int = MAX_LABELS,
        min_confidence: float = MIN_CONFIDENCE,
    ) -> None:
        self._client = client
        self._max_labels = max_labels
        self._min_percent = min_confidence * PERCENT

    def detect(self, image: BlurredImage) -> LabelSet:
        started = time.monotonic()
        try:
            response = self._client.detect_labels(
                Image={"Bytes": image.data},
                MaxLabels=self._max_labels,
                MinConfidence=self._min_percent,
            )
        except (BotoCoreError, ClientError) as error:
            raise ExternalServiceError(f"rekognition DetectLabels: {error}") from error
        labels = tuple(
            DetectedLabel(label["Name"], label.get("Confidence", 0.0) / PERCENT)
            for label in response.get("Labels", [])
            if "Name" in label
        )
        return LabelSet(
            labels=labels,
            model=MODEL,
            version=response.get("LabelModelVersion", "unknown"),
            latency_ms=round((time.monotonic() - started) * 1000),
        )
