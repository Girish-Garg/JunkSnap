"""Port for our own object detector (the trained YOLO model)."""

from abc import ABC, abstractmethod

from ml.domain.detections import DetectionSet
from ml.domain.images import BlurredImage


class ObjectDetector(ABC):
    @abstractmethod
    def detect(self, image: BlurredImage) -> DetectionSet:
        """Raises ExternalServiceError when the model cannot run."""
