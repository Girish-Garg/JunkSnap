"""overflowing_bin (contracts v1.7): judge answer, YOLO bin-plus-waste rule, stacker fallback."""

from dataclasses import replace

import pytest
from fakes import JUDGE_JSON, FakeBuilder, FakeDetector, FakeProvider, FixedClock, make_case
from model_fakes import meta_model

from ml.domain.detections import Detection, DetectionSet
from ml.domain.images import BlurredImage
from ml.domain.label_insights import LabelInsights
from ml.domain.llm import TaskConfig
from ml.domain.pricing import PriceTable
from ml.domain.verification import Claim, Thresholds
from ml.handlers.verify_body import VerifyBody
from ml.ports.object_detector import ObjectDetector
from ml.ports.signal import Signal
from ml.services.judge_answer import JudgeAnswer
from ml.services.label_signal import RekognitionLabelSignal
from ml.services.meta_combiner import MetaLearnerCombiner
from ml.services.provider_factory import ProviderFactory
from ml.services.provider_router import ProviderRouter
from ml.services.stacked_verifier import StackedVerifier
from ml.services.vision_judge import VisionJudge
from ml.services.yolo_signal import YoloSignal

OVERFLOWING = Claim("overflowing_bin", "overflowing")
UNTRAINED = "meta-learner has no training rows for overflowing_bin; judge decides"
BIN = ("bin", 0.9, 0.40, 0.40, 0.60, 0.70)


class BoxDetector(ObjectDetector):
    def __init__(self, *boxes: tuple[str, float, float, float, float, float]) -> None:
        self._found = DetectionSet(tuple(Detection(*box) for box in boxes), "yolo", "v1", 50)

    def detect(self, image: BlurredImage) -> DetectionSet:
        return self._found


def bin_answer(context: str) -> str:
    return JUDGE_JSON.replace('"waste_dump"', '"overflowing_bin"').replace(
        '"vacant_plot"', f'"{context}"'
    )


@pytest.mark.parametrize("context", ["overflowing", "damaged"])
def test_judge_answer_and_verify_body_accept_overflowing_bin(context: str) -> None:
    verdict = JudgeAnswer.model_validate_json(bin_answer(context)).to_verdict()
    assert (verdict.report_type, verdict.context) == ("overflowing_bin", context)
    body = VerifyBody.model_validate({
        "report_id": "rpt_1", "purpose": "report", "blurred_key": "media/reports/rpt_1.jpg",
        "report_type": "overflowing_bin", "context": context,
        "features": {"gps_accuracy_m": 5, "reputation": 0.5, "nearby_verified_reports": 0},
    })
    assert body.to_input().claim == Claim("overflowing_bin", context)


def test_a_context_of_another_type_becomes_null() -> None:
    verdict = JudgeAnswer.model_validate_json(bin_answer("no_pickup")).to_verdict()
    assert verdict.context is None


def test_yolo_bin_with_waste_spilling_beside_it_supports_the_claim() -> None:
    waste = ("waste_pile", 0.8, 0.62, 0.55, 0.80, 0.75)  # 0.02 right of a 0.3-tall bin
    result = YoloSignal(BoxDetector(BIN, waste)).measure(make_case(claim=OVERFLOWING))
    assert result.score == pytest.approx(0.8) and not result.neutral


def test_yolo_bin_alone_or_far_waste_is_weak_support() -> None:
    alone = YoloSignal(BoxDetector(BIN)).measure(make_case(claim=OVERFLOWING))
    far = ("waste_pile", 0.8, 0.0, 0.0, 0.10, 0.10)
    apart = YoloSignal(BoxDetector(BIN, far)).measure(make_case(claim=OVERFLOWING))
    assert alone.score == pytest.approx(0.45)
    assert apart.score == pytest.approx(0.45)


def test_no_bin_claims_keep_scoring_the_best_waste_box() -> None:
    waste = ("waste_pile", 0.7, 0.0, 0.0, 0.1, 0.1)
    result = YoloSignal(BoxDetector(BIN, waste)).measure(make_case(claim=Claim("no_bin", "no_bin")))
    assert result.score == pytest.approx(0.7)


def test_rekognition_scores_the_claim_without_a_missing_keyword_group() -> None:
    signal = RekognitionLabelSignal(FakeDetector({"Trash": 0.9, "Bin": 0.8}), LabelInsights())
    assert signal.measure(make_case(claim=OVERFLOWING)).score == pytest.approx(0.9)


def stacked(signals: list[Signal]) -> tuple[StackedVerifier, FakeProvider]:
    provider = FakeProvider("global.anthropic.claude-sonnet-4-6", [bin_answer("overflowing")])
    factory = ProviderFactory({"bedrock": FakeBuilder({provider.name: provider})})
    router = ProviderRouter({"judge": TaskConfig("bedrock", provider.name)}, factory, PriceTable())
    combiner = MetaLearnerCombiner(meta_model(), Thresholds())
    return StackedVerifier(signals, VisionJudge(router, "prompt"), combiner, FixedClock()), provider


def test_untrained_type_falls_back_to_the_judge_with_a_reason() -> None:
    yolo = YoloSignal(BoxDetector(BIN, ("waste_pile", 0.95, 0.6, 0.5, 0.8, 0.8)))
    verifier, provider = stacked([yolo])
    result = verifier.verify(make_case(claim=OVERFLOWING))
    assert len(provider.requests) == 1 and result.judge is not None
    assert (result.combiner.kind, result.combiner.reason) == ("fixed_weights", UNTRAINED)
    assert result.to_contract()["combiner"] == {"kind": "fixed_weights", "version": "fw-v0"}
    assert result.outcome.decision == "auto_verified"


def test_trained_types_stay_on_the_meta_learner() -> None:
    combiner = MetaLearnerCombiner(meta_model(), Thresholds())
    assert combiner.for_claim(Claim("waste_dump", "roadside")) is combiner
    assert combiner.for_claim(Claim("no_bin", "no_pickup")) is combiner
    assert combiner.for_claim(OVERFLOWING).info().reason == UNTRAINED
    refit = replace(meta_model(), report_types=frozenset({"overflowing_bin"}))
    trained = MetaLearnerCombiner(refit, Thresholds())
    assert trained.for_claim(OVERFLOWING) is trained
