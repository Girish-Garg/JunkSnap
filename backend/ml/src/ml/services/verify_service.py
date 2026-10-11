"""Use case behind POST /internal/verify."""

from ml.domain.case import VerificationCase, VerificationResult, VerifyInput
from ml.domain.purposes import PURPOSES, Purposes
from ml.ports.image_fitter import ImageFitter
from ml.ports.image_store import BlurredImageStore
from ml.services.stacked_verifier import StackedVerifier


class VerifyService:
    def __init__(
        self,
        images: BlurredImageStore,
        fitter: ImageFitter,
        verifier: StackedVerifier,
        purposes: Purposes = PURPOSES,  # the report rules in use (VetoLimits)
    ) -> None:
        self._images = images
        self._fitter = fitter
        self._verifier = verifier
        self._purposes = purposes

    def verify(self, request: VerifyInput) -> VerificationResult:
        case = VerificationCase(
            report_id=request.report_id,
            purpose=self._purposes.named(request.purpose),
            image=self._fitter.fit(self._images.read(request.blurred_key)),
            claim=request.claim,
            features=request.features,
        )
        return self._verifier.verify(case)
