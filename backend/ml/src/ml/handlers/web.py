"""ML web app (uvicorn ml.handlers.web:app, port UVICORN_PORT); routes in handlers/routers.py."""

from collections.abc import Sequence

from fastapi import APIRouter, FastAPI

from ml.handlers.routers import ROUTER_BUILDERS
from ml.logging_setup import JsonLogging
from ml.settings.core import CoreSettings

SERVICE_NAME = "ml"


def create_app(settings: CoreSettings, routers: Sequence[APIRouter]) -> FastAPI:
    """JSON logs, GET /healthz and every given router; no CORS, the app is cluster-internal."""
    JsonLogging({"service": SERVICE_NAME, "stage": settings.stage}).install()
    app = FastAPI(title="JunkSnap ml")

    @app.get("/healthz")
    def healthz() -> dict[str, bool]:
        return {"ok": True}

    for router in routers:
        app.include_router(router)
    return app


app = create_app(CoreSettings.load(), [build() for build in ROUTER_BUILDERS])
