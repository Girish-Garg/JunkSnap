"""Port for one verification signal: Rekognition labels now, YOLO and embeddings in A2."""

from abc import ABC, abstractmethod

from ml.domain.case import VerificationCase
from ml.domain.verification import SignalResult


class Signal(ABC):
    @abstractmethod
    def measure(self, case: VerificationCase) -> SignalResult:
        """Support for the case's claim, 0..1. Raises ExternalServiceError when the model fails."""
