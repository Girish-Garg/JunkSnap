"""Use case behind POST /internal/verify."""

from ml.domain.case import VerificationCase, VerificationResult, VerifyInput
from ml.domain.purposes import Purpose
from ml.ports.image_fitter import ImageFitter
from ml.ports.image_store import BlurredImageStore
from ml.services.stacked_verifier import StackedVerifier


class VerifyService:
    def __init__(
        self, images: BlurredImageStore, fitter: ImageFitter, verifier: StackedVerifier
    ) -> None:
        self._images = images
        self._fitter = fitter
        self._verifier = verifier

    def verify(self, request: VerifyInput) -> VerificationResult:
        case = VerificationCase(
            report_id=request.report_id,
            purpose=Purpose.named(request.purpose),
            image=self._fitter.fit(self._images.read(request.blurred_key)),
            claim=request.claim,
            features=request.features,
        )
        return self._verifier.verify(case)
