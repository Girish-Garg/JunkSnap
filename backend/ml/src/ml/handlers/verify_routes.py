"""POST /internal/verify: stacked verification of one blurred photo."""

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from agent.domain.errors import (
    InvalidClaimError,
    InvalidImageError,
    JunkSnapError,
    NotBlurredImageError,
)
from agent.handlers.verify_body import VerifyBody
from agent.handlers.verify_graph import VerifierBuilder
from agent.services.verify_service import VerifyService
from agent.settings.core import CoreSettings
from agent.settings.llm import LlmSettings
from agent.settings.verify import VerifySettings

logger = logging.getLogger(__name__)

BAD_REQUEST_ERRORS = (ValidationError, InvalidClaimError, InvalidImageError, NotBlurredImageError)


def build_verify_router() -> APIRouter:
    builder = VerifierBuilder(CoreSettings.load(), LlmSettings.load())
    images = builder.image_store(VerifySettings.load().public_bucket)
    return verify_router(VerifyService(images, builder.verifier()))


def verify_router(service: VerifyService) -> APIRouter:
    router = APIRouter()

    @router.post("/internal/verify")
    def verify(payload: Annotated[dict[str, Any], Body()]) -> JSONResponse:
        # Validated here, not by FastAPI, so a bad body gets the contract's 400 shape.
        try:
            result = service.verify(VerifyBody.model_validate(payload).to_input())
        except BAD_REQUEST_ERRORS as error:
            body = {"error": "bad_request", "message": str(error)[:300]}
            return JSONResponse(body, status_code=400)
        except JunkSnapError:
            logger.exception("verify_failed")
            body = {"error": "server_error", "message": "verification failed"}
            return JSONResponse(body, status_code=500)
        return JSONResponse(result.to_contract())

    return router
