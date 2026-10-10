import json
from pathlib import Path
from typing import Any

import pytest
from fakes import (
    CLEAN_FIELDS,
    JUDGE_JSON,
    FakeBuilder,
    FakeFitter,
    FakeImages,
    FakeProvider,
    FakeSignal,
    FixedClock,
    judge_json,
)
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

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

SCHEMAS = Path(__file__).resolve().parents[4] / "contracts" / "schemas"
SCHEMA = json.loads((SCHEMAS / "verification_result.schema.json").read_text("utf-8"))
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
CLEAN_JSON = judge_json(
    CLEAN_FIELDS, user_verdict="yes", user_verdict_confidence=0.95, scene_fits_site=True
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
    response = client(0.95, [JUDGE_JSON]).post("/internal/verify", json=REQUEST)

    assert response.status_code == 200
    body = response.json()
    assert (body["report_id"], body["purpose"], body["decision"]) == (
        "rpt_jdh_1", "report", "auto_verified"
    )
    assert body["is_clean"] is None
    assert body["combiner"] == {"kind": "fixed_weights", "version": "fw-v0"}
    assert body["features"] == REQUEST["features"]
    assert body["insights"] == {"composition": [], "size_class": None, "hazards": []}


def test_cleanup_confirmed_by_the_judge_is_clean() -> None:
    body = client(1.0, [CLEAN_JSON]).post("/internal/verify", json=CLEANUP).json()

    assert (body["purpose"], body["is_clean"], body["decision"]) == (
        "cleanup", True, "auto_verified"
    )
    assert body["judge"]["report_type"] == "not_waste"
    assert body["insights"] is None


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


def test_an_unsure_judge_answers_needs_confirmation_over_http() -> None:
    unsure = judge_json(garbage="uncertain", user_verdict="uncertain", user_verdict_confidence=0.5)
    body = client(0.95, [unsure]).post("/internal/verify", json=REQUEST).json()

    assert body["decision"] == "needs_confirmation"
    assert body["combiner"]["version"] == "fw-v0+judge_unsure:ask_reporter by bedrock/m@4.6"
    assert body["judge"]["attributes"]["user_verdict"] == "uncertain"
    assert body["judge"]["attributes"]["prompt"] == "judge_v1"
    Draft202012Validator(SCHEMA).validate(body)


def test_cleanup_key_must_be_under_media_cleanups() -> None:
    response = client(1.0).post(
        "/internal/verify", json={**CLEANUP, "blurred_key": "media/reports/cln_jdh_3c.jpg"}
    )

    assert response.status_code == 400
