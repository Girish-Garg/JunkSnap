from typing import Any

import pytest
from fakes import (
    JUDGE_JSON,
    FakeBuilder,
    FakeFitter,
    FakeImages,
    FakeProvider,
    FakeSignal,
    FixedClock,
)
from fastapi.testclient import TestClient

from ml.domain.llm import TaskConfig
from ml.domain.pricing import PriceTable
from ml.domain.verification import Thresholds
from ml.handlers.verify_routes import verify_router
from ml.handlers.web import create_app
from ml.services.combiner import FixedWeightCombiner
from ml.services.provider_factory import ProviderFactory
from ml.services.provider_router import ProviderRouter
from ml.services.stacked_verifier import StackedVerifier
from ml.services.verify_service import VerifyService
from ml.services.vision_judge import VisionJudge
from ml.settings.core import CoreSettings

REQUEST: dict[str, Any] = {
    "report_id": "rpt_jdh_1",
    "purpose": "report",
    "blurred_key": "media/reports/rpt_jdh_1.jpg",
    "report_type": "waste_dump",
    "context": "vacant_plot",
    "features": {"gps_accuracy_m": 6, "reputation": 0.74, "nearby_verified_reports": 5},
}
CLEANUP = {**REQUEST, "report_id": "cln_jdh_3c", "purpose": "cleanup",
           "blurred_key": "media/cleanups/cln_jdh_3c.jpg"}
CLEAN_JSON = (
    JUDGE_JSON.replace('"waste_dump"', '"not_waste"').replace('"vacant_plot"', "null")
    .replace('"confidence": 0.9}', '"confidence": 0.95, "scene_fits_site": true}')
)


def client(score: float, judge_answers: list[str | Exception] | None = None) -> TestClient:
    provider = FakeProvider("m", judge_answers or [])
    factory = ProviderFactory({"bedrock": FakeBuilder({"m": provider})})
    router = ProviderRouter({"judge": TaskConfig("bedrock", "m")}, factory, PriceTable())
    verifier = StackedVerifier(
        [FakeSignal("rekognition_labels", score)],
        VisionJudge(router, "prompt"),
        FixedWeightCombiner(Thresholds()),
        FixedClock(),
    )
    service = VerifyService(FakeImages(), FakeFitter(), verifier)
    return TestClient(create_app(CoreSettings(), [verify_router(service)]))


def test_report_returns_verification_result() -> None:
    response = client(0.95).post("/internal/verify", json=REQUEST)

    assert response.status_code == 200
    body = response.json()
    assert (body["report_id"], body["purpose"], body["decision"]) == (
        "rpt_jdh_1", "report", "auto_verified"
    )
    assert body["is_clean"] is None
    assert body["combiner"] == {"kind": "fixed_weights", "version": "fw-v0"}
    assert body["features"] == REQUEST["features"]
    assert body["insights"]["burning"] is False


def test_cleanup_confirmed_by_the_judge_is_clean() -> None:
    body = client(1.0, [CLEAN_JSON]).post("/internal/verify", json=CLEANUP).json()

    assert (body["purpose"], body["is_clean"], body["decision"]) == (
        "cleanup", True, "auto_verified"
    )
    assert body["judge"]["report_type"] == "not_waste"


@pytest.mark.parametrize(
    "change",
    [
        {"blurred_key": "reports/upl_jdh_1.jpg"},
        {"context": "sewage"},
        {"report_id": "cln_jdh_1"},
        {"blurred_key": "media/cleanups/rpt_jdh_1.jpg"},
        {"purpose": "audit"},
    ],
)
def test_bad_requests_get_the_contract_error(change: dict[str, str]) -> None:
    response = client(0.9).post("/internal/verify", json={**REQUEST, **change})

    assert response.status_code == 400
    assert response.json()["error"] == "bad_request"


def test_cleanup_key_must_be_under_media_cleanups() -> None:
    response = client(1.0).post(
        "/internal/verify", json={**CLEANUP, "blurred_key": "media/reports/cln_jdh_3c.jpg"}
    )

    assert response.status_code == 400
