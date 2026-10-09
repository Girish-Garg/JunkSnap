import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any

import pytest
from agent.domain.case import CombinerInfo, VerificationCase, VerificationResult
from agent.domain.images import BlurredImage
from agent.domain.purposes import Purpose
from agent.domain.verification import (
    CaseFeatures,
    Claim,
    JudgeVerdict,
    Outcome,
    SignalResult,
    Thresholds,
)
from agent.services.combiner import FixedWeightCombiner
from agent.services.label_signal import RekognitionLabelSignal
from fakes import JPEG, FakeDetector, make_case
from jsonschema import Draft202012Validator

# contracts/ arrives with PR #14; CONTRACTS_DIR points at another checkout until then.
CONTRACTS = Path(os.environ.get("CONTRACTS_DIR", Path(__file__).resolve().parents[4] / "contracts"))
SCHEMA_PATH = CONTRACTS / "schemas" / "verification_result.schema.json"
DATE_TIME = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")

pytestmark = pytest.mark.skipif(not SCHEMA_PATH.exists(), reason=f"no schema at {SCHEMA_PATH}")


def validator() -> Draft202012Validator:
    return Draft202012Validator(json.loads(SCHEMA_PATH.read_text(encoding="utf-8")))


def fixtures() -> list[Path]:
    return sorted((CONTRACTS / "fixtures").glob("verification_result.*.json"))


def produced(purpose: str, labels: dict[str, float], judge: JudgeVerdict | None) -> dict[str, Any]:
    case = make_case(purpose)
    signals = [RekognitionLabelSignal(FakeDetector(labels)).measure(case)]
    combiner = FixedWeightCombiner(Thresholds())
    result = VerificationResult(
        case, combiner.combine(signals, case.purpose), combiner.thresholds, tuple(signals),
        judge, combiner.info(), datetime.fromisoformat("2026-10-10T02:15:03+00:00"),
    )
    return result.to_contract()


def from_fixture(data: dict[str, Any]) -> VerificationResult:
    judge = data["judge"]
    case = VerificationCase(
        data["report_id"], Purpose.named(data["purpose"]), BlurredImage("media/x.jpg", JPEG),
        Claim("waste_dump", "vacant_plot"), CaseFeatures(**data["features"]),
    )
    return VerificationResult(
        case=case,
        outcome=Outcome(data["probability"], data["decision"], data["disagreement"],
                        data["is_clean"]),
        thresholds=Thresholds(**data["thresholds"]),
        signals=tuple(SignalResult(**signal) for signal in data["signals"]),
        judge=None if judge is None else JudgeVerdict(
            **{**judge, "readable_brands": tuple(judge["readable_brands"])}, confidence=0.9
        ),
        combiner=CombinerInfo(**data["combiner"]),
        decided_at=datetime.fromisoformat(data["decided_at"]),
        embedding_key=data["embedding_key"],
    )


@pytest.mark.parametrize(
    ("purpose", "labels"),
    [("report", {"Garbage": 0.95}), ("report", {"Road": 0.9}), ("cleanup", {"Road": 0.9}),
     ("cleanup", {"Garbage": 0.7})],
)
def test_output_matches_schema(purpose: str, labels: dict[str, float]) -> None:
    output = produced(purpose, labels, judge=None)

    validator().validate(output)
    assert DATE_TIME.match(str(output["decided_at"]))


def test_output_with_judge_matches_schema() -> None:
    verdict = JudgeVerdict("not_waste", None, False, ("SAMPLE",), "A clean street.", 0.8)

    validator().validate(produced("report", {"Garbage": 0.7}, verdict))


def test_fixtures_exist() -> None:
    assert len(fixtures()) >= 2


@pytest.mark.parametrize("path", fixtures(), ids=lambda path: path.name)
def test_fixture_round_trips(path: Path) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))

    assert from_fixture(data).to_contract() == data
