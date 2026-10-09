from typing import Any

from agent.domain.llm import TaskConfig
from agent.domain.pricing import PriceTable
from agent.domain.verification import Thresholds
from agent.handlers.verify_routes import verify_router
from agent.handlers.web import create_app
from agent.services.combiner import FixedWeightCombiner
from agent.services.provider_factory import ProviderFactory
from agent.services.provider_router import ProviderRouter
from agent.services.stacked_verifier import StackedVerifier
from agent.services.verify_service import VerifyService
from agent.services.vision_judge import VisionJudge
from agent.settings.core import CoreSettings
from fakes import FakeBuilder, FakeImages, FakeSignal, FixedClock
from fastapi.testclient import TestClient

REQUEST: dict[str, Any] = {
    "report_id": "rpt_jdh_1",
    "purpose": "report",
    "blurred_key": "media/reports/rpt_jdh_1.jpg",
    "report_type": "waste_dump",
    "context": "vacant_plot",
    "features": {"gps_accuracy_m": 6, "reputation": 0.74, "nearby_verified_reports": 5},
}


def client(score: float) -> TestClient:
    router = ProviderRouter({"judge": TaskConfig("bedrock", "m")}, ProviderFactory(
        {"bedrock": FakeBuilder({"m": None})}), PriceTable())
    verifier = StackedVerifier(
        [FakeSignal("rekognition_labels", score)],
        VisionJudge(router, "prompt"),
        FixedWeightCombiner(Thresholds()),
        FixedClock(),
    )
    app = create_app(CoreSettings(), [verify_router(VerifyService(FakeImages(), verifier))])
    return TestClient(app)


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


def test_cleanup_returns_is_clean() -> None:
    cleanup = {**REQUEST, "report_id": "cln_jdh_3c", "purpose": "cleanup",
               "blurred_key": "media/cleanups/cln_jdh_3c.jpg"}

    body = client(0.9).post("/internal/verify", json=cleanup).json()

    assert (body["purpose"], body["is_clean"], body["decision"]) == (
        "cleanup", True, "auto_verified"
    )


def test_key_outside_media_is_a_bad_request() -> None:
    response = client(0.9).post(
        "/internal/verify", json={**REQUEST, "blurred_key": "reports/upl_jdh_1.jpg"}
    )

    assert response.status_code == 400
    assert response.json()["error"] == "bad_request"


def test_context_of_another_type_is_a_bad_request() -> None:
    response = client(0.9).post("/internal/verify", json={**REQUEST, "context": "sewage"})

    assert response.status_code == 400
