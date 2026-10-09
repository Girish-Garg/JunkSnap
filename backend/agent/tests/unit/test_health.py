from fastapi.testclient import TestClient

from agent.handlers.web import create_app
from agent.settings import Settings


def test_healthz_reports_service_and_stage() -> None:
    client = TestClient(create_app(Settings(stage="test")))

    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "agent", "stage": "test"}


def test_cors_allows_configured_origin() -> None:
    origin = "https://junksnap.example"
    client = TestClient(create_app(Settings(cors_origins=(origin,))))

    response = client.get("/healthz", headers={"Origin": origin})

    assert response.headers["access-control-allow-origin"] == origin
