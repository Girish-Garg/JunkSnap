import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any

import pytest
from fakes import JPEG, FakeBuilder, FakeDetector, FakeProvider, FixedClock, judge_json, make_case
from jsonschema import Draft202012Validator

from ml.domain.case import CombinerInfo, VerificationCase, VerificationResult
from ml.domain.images import BlurredImage
from ml.domain.insights import HazardSighting, Insights, InsightSource, MaterialShare, SizeEstimate
from ml.domain.judge_attributes import JudgeAttributes, TriState
from ml.domain.label_insights import LabelInsights
from ml.domain.llm import TaskConfig
from ml.domain.pricing import PriceTable
from ml.domain.purposes import Purpose
from ml.domain.verification import (
    CaseFeatures,
    Claim,
    JudgeVerdict,
    Outcome,
    SignalResult,
    Thresholds,
)
from ml.services.combiner import FixedWeightCombiner
from ml.services.label_signal import RekognitionLabelSignal
from ml.services.provider_factory import ProviderFactory
from ml.services.provider_router import ProviderRouter
from ml.services.stacked_verifier import StackedVerifier
from ml.services.vision_judge import VisionJudge

CONTRACTS = Path(__file__).resolve().parents[4] / "contracts"
SCHEMA = json.loads((CONTRACTS / "schemas" / "verification_result.schema.json").read_text("utf-8"))
DATE_TIME = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
JUDGE_ANSWER = judge_json(
    composition=[{"material": "organic", "share": 0.3}], size_class="large",
    hazards=[{"hazard": "dead_animal", "confidence": 0.6}], scene_fits_site=True,
)
# A cleanup photo the judge finds clean.
CLEAN_ANSWER = judge_json(garbage="no", context=None, scene_fits_site=True)


def produced(purpose: str, labels: dict[str, float]) -> dict[str, Any]:
    reply = JUDGE_ANSWER if purpose == "report" else CLEAN_ANSWER
    judge = FakeProvider("global.anthropic.claude-sonnet-4-6", [reply])
    factory = ProviderFactory({"bedrock": FakeBuilder({judge.name: judge})})
    router = ProviderRouter({"judge": TaskConfig("bedrock", judge.name)}, factory, PriceTable())
    verifier = StackedVerifier(
        [RekognitionLabelSignal(FakeDetector(labels), LabelInsights())],
        VisionJudge(router, "prompt"),
        FixedWeightCombiner(Thresholds()),
        FixedClock(),
    )
    return verifier.verify(make_case(purpose)).to_contract()


def source_from(data: dict[str, str]) -> InsightSource:
    return InsightSource(**data)


def insights_from(data: dict[str, Any] | None) -> Insights:
    if data is None:
        return Insights()
    size = data["size_class"]
    return Insights(
        composition=tuple(
            MaterialShare(s["material"], s["share_pct"] / 100, source_from(s["source"]))
            for s in data["composition"]
        ),
        size_class=size and SizeEstimate(size["value"], source_from(size["source"])),
        hazards=tuple(
            HazardSighting(h["hazard"], h["confidence"], source_from(h["source"]))
            for h in data["hazards"]
        ),
    )


def attributes_from(data: dict[str, Any] | None) -> JudgeAttributes:
    """A fixture from before contracts v1.16 has none; the test drops these placeholders."""
    raw = data or {
        "garbage": "yes", "bin": "no", "bin_overflowing_or_broken": "no",
        "water_contamination": "no", "construction_debris": "no", "burning": "no",
        "photo_usable": "yes", "user_verdict": "yes", "user_verdict_confidence": 0.9,
        "prompt": "judge_v0",
    }
    numbers = ("user_verdict_confidence", "prompt")
    states = {key: TriState(value) for key, value in raw.items() if key not in numbers}
    return JudgeAttributes(
        **states, user_verdict_confidence=raw["user_verdict_confidence"], prompt=raw["prompt"]
    )


def verdict_from(judge: dict[str, Any] | None) -> JudgeVerdict | None:
    if judge is None:
        return None
    fields = {key: value for key, value in judge.items() if key != "attributes"}
    return JudgeVerdict(
        **{**fields, "readable_brands": tuple(judge["readable_brands"])}, confidence=0.9,
        scene_fits_site=None, attributes=attributes_from(judge.get("attributes")),
    )


def from_fixture(data: dict[str, Any]) -> VerificationResult:
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
        judge=verdict_from(data["judge"]),
        combiner=CombinerInfo(**data["combiner"]),
        decided_at=datetime.fromisoformat(data["decided_at"]),
        embedding_key=data["embedding_key"],
        insights=insights_from(data["insights"]),
    )


@pytest.mark.parametrize(
    ("purpose", "labels"),
    [
        ("report", {"Garbage": 0.95, "Plastic": 0.8, "Smoke": 0.7}),
        ("report", {"Garbage": 0.7, "Cardboard": 0.6}),
        ("report", {"Road": 0.9}),
        ("cleanup", {"Road": 0.9}),
        ("cleanup", {"Garbage": 0.7}),
    ],
)
def test_output_matches_schema(purpose: str, labels: dict[str, float]) -> None:
    output = produced(purpose, labels)

    Draft202012Validator(SCHEMA).validate(output)
    assert DATE_TIME.match(str(output["decided_at"]))


def test_judge_measures_and_labels_fill_the_rest() -> None:
    output = produced("report", {"Garbage": 0.7, "Cardboard": 0.6})

    insights = output["insights"]
    assert [s["source"]["signal"] for s in insights["composition"]] == [
        "rekognition_labels", "vision_judge"
    ]
    assert insights["size_class"]["source"]["model"] == "global.anthropic.claude-sonnet-4-6"
    assert [h["hazard"] for h in insights["hazards"]] == ["dead_animal"]


def test_cleanup_insights_are_null() -> None:
    assert produced("cleanup", {"Road": 0.9})["insights"] is None


def test_fixtures_exist() -> None:
    assert len(sorted((CONTRACTS / "fixtures").glob("verification_result.*.json"))) >= 2


@pytest.mark.parametrize(
    "path",
    sorted((CONTRACTS / "fixtures").glob("verification_result.*.json")),
    ids=lambda path: path.name,
)
def test_fixture_round_trips(path: Path) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    output = from_fixture(data).to_contract()
    judge = output["judge"]
    if isinstance(judge, dict) and "attributes" not in (data["judge"] or {}):
        judge.pop("attributes")  # a producer from before contracts v1.16

    assert output == data


def test_a_report_carries_the_judges_structured_answer() -> None:
    output = produced("report", {"Garbage": 0.95})
    judge = output["judge"]

    assert isinstance(judge, dict)
    assert judge["attributes"] == {
        "garbage": "yes", "bin_overflowing_or_broken": "no", "water_contamination": "no",
        "construction_debris": "no", "bin": "no", "burning": "no", "photo_usable": "yes",
        "user_verdict": "yes", "user_verdict_confidence": 0.9, "prompt": "judge_v1",
    }
    assert (judge["report_type"], judge["context"], judge["burning"]) == (
        "waste_dump", "vacant_plot", False,
    )
