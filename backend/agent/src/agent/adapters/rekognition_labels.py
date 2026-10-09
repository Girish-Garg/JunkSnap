"""LabelDetector over Rekognition DetectLabels."""

import time
from typing import TYPE_CHECKING

from botocore.exceptions import BotoCoreError, ClientError

from agent.domain.errors import ExternalServiceError
from agent.domain.images import BlurredImage
from agent.domain.labels import DetectedLabel, LabelSet
from agent.ports.label_detector import LabelDetector

if TYPE_CHECKING:
    from mypy_boto3_rekognition import RekognitionClient

MODEL = "DetectLabels"
MAX_LABELS = 50
MIN_CONFIDENCE = 50.0  # percent, Rekognition's unit


class RekognitionLabelDetector(LabelDetector):
    def __init__(self, client: "RekognitionClient") -> None:
        self._client = client

    def detect(self, image: BlurredImage) -> LabelSet:
        started = time.monotonic()
        try:
            response = self._client.detect_labels(
                Image={"Bytes": image.data}, MaxLabels=MAX_LABELS, MinConfidence=MIN_CONFIDENCE
            )
        except (BotoCoreError, ClientError) as error:
            raise ExternalServiceError(f"rekognition DetectLabels: {error}") from error
        labels = tuple(
            DetectedLabel(label["Name"], label.get("Confidence", 0.0) / 100)
            for label in response.get("Labels", [])
            if "Name" in label
        )
        return LabelSet(
            labels=labels,
            model=MODEL,
            version=response.get("LabelModelVersion", "unknown"),
            latency_ms=round((time.monotonic() - started) * 1000),
        )
