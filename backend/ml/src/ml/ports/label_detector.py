"""Port for an image label detector (Rekognition DetectLabels)."""

from abc import ABC, abstractmethod

from ml.domain.images import BlurredImage
from ml.domain.labels import LabelSet


class LabelDetector(ABC):
    @abstractmethod
    def detect(self, image: BlurredImage) -> LabelSet:
        """Raises ExternalServiceError when the call fails."""
