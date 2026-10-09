"""Use case behind POST /internal/verify."""

from ml.domain.case import VerificationCase, VerificationResult, VerifyInput
from ml.domain.purposes import Purpose
from ml.ports.image_store import BlurredImageStore
from ml.services.stacked_verifier import StackedVerifier


class VerifyService:
    """Reads the blurred photo by key and runs the stacked verifier on it."""

    def __init__(self, images: BlurredImageStore, verifier: StackedVerifier) -> None:
        self._images = images
        self._verifier = verifier

    def verify(self, request: VerifyInput) -> VerificationResult:
        case = VerificationCase(
            report_id=request.report_id,
            purpose=Purpose.named(request.purpose),
            image=self._images.read(request.blurred_key),
            claim=request.claim,
            features=request.features,
        )
        return self._verifier.verify(case)
