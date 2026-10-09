"""ML web app (uvicorn ml.handlers.web:app --port 8000); routes come from handlers/routers.py."""

from collections.abc import Sequence

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ml.handlers.routers import ROUTER_BUILDERS
from ml.logging_setup import JsonLogging
from ml.settings.core import CoreSettings

SERVICE_NAME = "ml"


def create_app(settings: CoreSettings, routers: Sequence[APIRouter]) -> FastAPI:
    """Build the app: JSON logs, CORS, GET /healthz and every given router."""
    JsonLogging({"service": SERVICE_NAME, "stage": settings.stage}).install()
    app = FastAPI(title="JunkSnap ml")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_origins()),
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/healthz")
    def healthz() -> dict[str, bool]:
        return {"ok": True}

    for router in routers:
        app.include_router(router)
    return app


app = create_app(CoreSettings.load(), [build() for build in ROUTER_BUILDERS])
