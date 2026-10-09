import json
import logging

import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient

from ml.handlers.web import create_app
from ml.settings.core import CoreSettings


def test_healthz_returns_ok() -> None:
    client = TestClient(create_app(CoreSettings(), []))

    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_sends_no_cors_headers() -> None:
    client = TestClient(create_app(CoreSettings(JUNKSNAP_STAGE="demo"), []))

    response = client.get("/healthz", headers={"Origin": "https://a.example"})

    assert "access-control-allow-origin" not in response.headers


def test_serves_given_routers() -> None:
    router = APIRouter()
    router.add_api_route("/ping", lambda: {"pong": True})
    client = TestClient(create_app(CoreSettings(), [router]))

    assert client.get("/ping").json() == {"pong": True}


def test_logs_uvicorn_lines_as_json(capsys: pytest.CaptureFixture[str]) -> None:
    create_app(CoreSettings(JUNKSNAP_STAGE="demo"), [])

    logging.getLogger("uvicorn.access").info("GET /healthz 200")

    line = json.loads(capsys.readouterr().out.strip())
    assert line["message"] == "GET /healthz 200"
    assert line["service"] == "ml"
    assert line["stage"] == "demo"
