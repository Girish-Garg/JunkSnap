"""Port for one verification signal: Rekognition labels now; YOLO and embeddings in A2."""

from abc import ABC, abstractmethod

from agent.domain.case import VerificationCase
from agent.domain.verification import SignalResult


class Signal(ABC):
    """Strategy: measures how far one model supports the case's claim, from 0 to 1."""

    @abstractmethod
    def measure(self, case: VerificationCase) -> SignalResult:
        """Score the case's blurred image. Raises ExternalServiceError when the model fails."""
