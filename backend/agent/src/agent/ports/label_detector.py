"""Port for an image label detector (Rekognition DetectLabels)."""

from abc import ABC, abstractmethod

from agent.domain.images import BlurredImage
from agent.domain.labels import LabelSet


class LabelDetector(ABC):
    """Returns the labels it sees in a blurred image."""

    @abstractmethod
    def detect(self, image: BlurredImage) -> LabelSet:
        """Labels with confidence 0..1. Raises ExternalServiceError when the call fails."""
