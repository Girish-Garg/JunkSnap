"""Agent web service. Run with: uvicorn agent.handlers.web:app --port 8080"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from agent.settings import Settings

SERVICE_NAME = "agent"


def create_app(settings: Settings) -> FastAPI:
    """Build the FastAPI app and its routes from the given settings."""
    app = FastAPI(title="JunkSnap agent")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/healthz")
    def healthz() -> dict[str, str]:
        return {"status": "ok", "service": SERVICE_NAME, "stage": settings.stage}

    return app


app = create_app(Settings.load())
