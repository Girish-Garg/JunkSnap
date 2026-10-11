"""Each tuning variable reaches the class it tunes; unset, the result is today's."""

from dataclasses import replace
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import numpy as np
import pytest
from fakes import (
    CLEAN_FIELDS,
    FakeBuilder,
    FakeFitter,
    FakeImages,
    FakeProvider,
    FakeSignal,
    FixedClock,
    judge_json,
    make_case,
    provider_error,
)
from model_fakes import FakeEmbedder, meta_model, two_dim_heads
from PIL import Image

from ml.adapters.onnx_session import OnnxSessionLoader
from ml.domain.case import VerificationResult, VerifyInput
from ml.domain.errors import ConfigError
from ml.domain.images import BlurredImage
from ml.domain.llm import TaskConfig
from ml.domain.pricing import PriceTable
from ml.domain.verification import CaseFeatures, Claim, SignalResult, Thresholds
from ml.handlers.client_configs import ClientConfigs
from ml.handlers.judge_timeouts import JudgeTimeouts
from ml.handlers.tuned_parts import TunedParts
from ml.handlers.verify_routes import build_verify_router
from ml.services.provider_factory import ProviderFactory
from ml.services.provider_router import ProviderRouter
from ml.services.stacked_verifier import StackedVerifier
from ml.services.verify_service import VerifyService
from ml.services.vision_judge import VisionJudge
from ml.settings.tuning import Tuning

NOVA = "apac.amazon.nova-lite-v1:0"
KEY = "media/reports/rpt_jdh_1.jpg"


def tuned(monkeypatch: pytest.MonkeyPatch, variables: dict[str, str]) -> TunedParts:
    for name, value in variables.items():
        monkeypatch.setenv(name, value)
    return TunedParts(Tuning.load())


def judged(parts: TunedParts, *script: str | Exception) -> tuple[VisionJudge, FakeProvider]:
    provider = FakeProvider(NOVA, script)
    factory = ProviderFactory({"bedrock": FakeBuilder({NOVA: provider})})
    tasks = {"judge": TaskConfig("bedrock", NOVA)}
    router = ProviderRouter(tasks, factory, PriceTable(), parts.attempts(None))
    return parts.judge(router, "prompt"), provider


def verify(parts: TunedParts, signal: SignalResult, answer: str | Exception) -> VerificationResult:
    """One detector and the judge through VerifyService, with the tuned report rules."""
    judge = judged(parts, answer)[0]
    detector = FakeSignal(signal.name, signal.score)
    verifier = StackedVerifier([detector], judge, parts.fixed_combiner(), FixedClock())
    claim, features = Claim("waste_dump", "roadside"), CaseFeatures(5, 0.5, 0)
    service = VerifyService(FakeImages(), FakeFitter(), verifier, parts.purposes())
    return service.verify(VerifyInput("rpt_jdh_1", "report", KEY, claim, features))


def scored(name: str, score: float) -> SignalResult:
    return SignalResult(name, score, "junksnap", "fake", "1", 10)


def png(width: int, height: int) -> BlurredImage:
    buffer = BytesIO()
    Image.new("RGB", (width, height), "gray").save(buffer, format="PNG")
    return BlurredImage(KEY, buffer.getvalue())


@pytest.mark.parametrize(
    ("variables", "decision"),
    [({}, "auto_verified"), ({"ML_AUTO_VERIFY_MIN": "0.95"}, "community_check")],
)
def test_the_decision_floors_reach_the_result(
    monkeypatch: pytest.MonkeyPatch, variables: dict[str, str], decision: str
) -> None:
    parts = tuned(monkeypatch, variables)
    result = verify(parts, scored("rekognition_labels", 0.95), judge_json())  # 0.92 combined
    assert result.outcome.decision == decision
    floor = float(variables.get("ML_AUTO_VERIFY_MIN", 0.85))
    assert result.to_contract()["thresholds"] == Thresholds(floor, 0.5).to_contract()


@pytest.mark.parametrize(
    ("variables", "decision", "reason"),
    [
        ({}, "community_check", "judge_no:detector_yes"),
        ({"ML_YOLO_LIFT_MIN": "0.95"}, "rejected", "judge_veto:not_waste"),
    ],
)
def test_yolo_lifts_a_judge_no_only_at_its_variable(
    monkeypatch: pytest.MonkeyPatch, variables: dict[str, str], decision: str, reason: str
) -> None:
    result = verify(tuned(monkeypatch, variables), scored("yolo", 0.9), judge_json(CLEAN_FIELDS))
    veto = result.outcome.veto
    assert (result.outcome.decision, veto and veto.reason) == (decision, reason)


@pytest.mark.parametrize(
    ("variables", "reason"),
    [({}, None), ({"ML_DETECTORS_VETO_MAX": "0.4"}, "detectors_veto:no_waste")],
)
def test_the_detectors_veto_fires_under_its_variable(
    monkeypatch: pytest.MonkeyPatch, variables: dict[str, str], reason: str | None
) -> None:
    parts = tuned(monkeypatch, variables)
    result = verify(parts, scored("rekognition_labels", 0.3), provider_error())  # judge outage
    veto = result.outcome.veto
    assert (result.outcome.decision, veto and veto.reason) == ("rejected", reason)


def test_the_gap_and_weights_reach_both_combiners(monkeypatch: pytest.MonkeyPatch) -> None:
    variables = {"ML_DISAGREEMENT_GAP": "0.3", "ML_WEIGHT_REKOGNITION_LABELS": "1",
                 "ML_WEIGHT_VISION_JUDGE": "3"}
    parts = tuned(monkeypatch, variables)
    signals = [scored("rekognition_labels", 0.2), scored("vision_judge", 0.6)]
    fixed = parts.fixed_combiner()
    assert fixed.disagree(signals)
    assert fixed.probability(signals) == pytest.approx((0.2 + 3 * 0.6) / 4)
    water = Claim("contaminated_water", "stagnant")  # no meta-learner rows: the fixed weights
    outcome = parts.meta_combiner(meta_model()).for_claim(water, signals).combine(
        signals, make_case().purpose
    )
    assert outcome.disagreement and outcome.probability == pytest.approx(0.5)


class FakeRekognition:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def detect_labels(self, **kwargs: Any) -> dict[str, Any]:
        self.calls.append(kwargs)
        labels = [{"Name": "Bottle", "Confidence": 90.0}, {"Name": "Smoke", "Confidence": 70.0}]
        return {"Labels": labels, "LabelModelVersion": "3.0"}


@pytest.mark.parametrize(
    ("variables", "expected"),
    [
        ({}, (50, 50.0, 0.54, ["burning"])),
        ({"ML_REKOGNITION_MAX_LABELS": "20", "ML_REKOGNITION_MIN_CONFIDENCE": "0.7",
          "ML_LABEL_WEAK_WEIGHT": "1", "ML_LABEL_HAZARD_MIN": "0.75"}, (20, 70.0, 0.9, [])),
    ],
)
def test_the_label_variables_reach_rekognition_and_its_reading(
    monkeypatch: pytest.MonkeyPatch, variables: dict[str, str], expected: tuple[object, ...]
) -> None:
    """The query sent; Bottle is a weak waste_dump label, Smoke a burning one at 0.7."""
    client = FakeRekognition()
    result = tuned(monkeypatch, variables).label_signal(client).measure(make_case())
    hazards = [sighting.hazard for sighting in result.insights.hazards]
    call = client.calls[0]
    assert (call["MaxLabels"], call["MinConfidence"], round(result.score, 4), hazards) == expected


class FakeYoloSession:
    """A 64 px end-to-end export: a waste pile at 0.9 over a fifth of the image, one at 0.3."""

    def get_modelmeta(self) -> SimpleNamespace:
        return SimpleNamespace(custom_metadata_map={"names": "{0: 'waste_pile', 1: 'burning'}"})

    def get_inputs(self) -> list[SimpleNamespace]:
        return [SimpleNamespace(shape=[1, 3, 64, 64], name="images")]

    def run(self, outputs: object, feeds: object) -> list[np.ndarray]:
        rows = [[0, 0, 28.6, 28.6, 0.9, 0], [40, 40, 44, 44, 0.3, 0], [0, 0, 8, 8, 0.92, 1]]
        return [np.array([rows], dtype=np.float32)]


@pytest.mark.parametrize(
    ("variables", "expected"),
    [
        ({}, (3, "medium", ["burning"])),
        ({"ML_YOLO_MIN_CONFIDENCE": "0.5", "ML_YOLO_SIZE_MEDIUM_MAX": "0.15",
          "ML_YOLO_SIZE_SMALL_MAX": "0.05", "ML_YOLO_HAZARD_MIN": "0.95"}, (2, "large", [])),
    ],
)
def test_the_yolo_variables_reach_the_detector_and_its_reading(
    monkeypatch: pytest.MonkeyPatch, variables: dict[str, str], expected: tuple[object, ...]
) -> None:
    """Boxes kept, the size class and hazards."""
    monkeypatch.setattr(OnnxSessionLoader, "open", staticmethod(lambda path: FakeYoloSession()))
    signal = tuned(monkeypatch, variables).yolo_signal(Path("yolo.onnx"), "v")
    result = signal.measure(replace(make_case(), image=png(64, 64)))
    found = result.insights
    size = None if found.size_class is None else found.size_class.value
    hazards = [sighting.hazard for sighting in found.hazards]
    assert (len(result.notes), size, hazards) == expected


@pytest.mark.parametrize(("variables", "hazards"), [({}, ["burning"]),
                                                    ({"ML_EMBEDDING_HAZARD_MIN": "0.99"}, [])])
def test_the_embedding_hazard_floor_reaches_its_signal(
    monkeypatch: pytest.MonkeyPatch, variables: dict[str, str], hazards: list[str]
) -> None:
    signal = tuned(monkeypatch, variables).embedding_signal(FakeEmbedder((1.0, 0.0)),
                                                            two_dim_heads())
    found = signal.measure(make_case()).insights.hazards  # the burning head says 0.73
    assert [sighting.hazard for sighting in found] == hazards


@pytest.mark.parametrize(
    ("variables", "expected"),
    [
        ({}, (700, 0.0, ("A", "B", "C"), True)),
        ({"ML_JUDGE_MAX_TOKENS": "900", "ML_JUDGE_TEMPERATURE": "0.2",
          "ML_JUDGE_HAZARD_MIN": "0.9", "ML_JUDGE_BRANDS_MAX": "2"}, (900, 0.2, ("A", "B"), False)),
    ],
)
def test_the_judge_variables_reach_its_request_and_its_reading(
    monkeypatch: pytest.MonkeyPatch, variables: dict[str, str], expected: tuple[object, ...]
) -> None:
    """Burning yes needs a burning hazard at the floor; this one says 0.8."""
    answer = judge_json(burning="yes", hazards=[{"hazard": "burning", "confidence": 0.8}],
                        readable_brands=["A", "B", "C"])
    judge, provider = judged(tuned(monkeypatch, variables), answer)
    reading = judge.judge(make_case())
    request = provider.requests[0]
    assert reading is not None
    verdict = reading.verdict
    seen = (request.max_tokens, request.temperature, verdict.readable_brands, verdict.burning)
    assert seen == expected


@pytest.mark.parametrize(("retries", "asked"), [("1", 2), ("0", 1)])
def test_an_invalid_answer_is_asked_again_as_often_as_set(
    monkeypatch: pytest.MonkeyPatch, retries: str, asked: int
) -> None:
    parts = tuned(monkeypatch, {"ML_JUDGE_INVALID_ANSWER_RETRIES": retries})
    judge, provider = judged(parts, "not json", "not json")
    assert judge.judge(make_case()) is None
    assert len(provider.requests) == asked


def test_the_image_variables_reach_the_fitter(monkeypatch: pytest.MonkeyPatch) -> None:
    parts = tuned(monkeypatch, {"ML_IMAGE_MAX_SIDE_PX": "1024", "ML_IMAGE_JPEG_QUALITIES": "[70]"})
    fitted = parts.fitter().fit(png(4000, 1000))
    with Image.open(BytesIO(fitted.data)) as picture:
        assert (picture.format, max(picture.size)) == ("JPEG", 1024)


def test_the_timing_variables_reach_every_client(monkeypatch: pytest.MonkeyPatch) -> None:
    variables = {
        "ML_WORKER_BUDGET_S": "90", "ML_DETECTORS_BUDGET_S": "15", "ML_JUDGE_READ_TIMEOUT_S": "10",
        "ML_JUDGE_CONNECT_TIMEOUT_S": "2", "ML_JUDGE_ATTEMPTS": "3", "ML_AWS_READ_TIMEOUT_S": "3",
        "ML_AWS_CONNECT_TIMEOUT_S": "1", "ML_AWS_ATTEMPTS": "3",
        "ML_MODEL_DOWNLOAD_READ_TIMEOUT_S": "45", "ML_MODEL_DOWNLOAD_CONNECT_TIMEOUT_S": "6",
        "ML_MODEL_DOWNLOAD_ATTEMPTS": "4", "ML_OFFLINE_READ_TIMEOUT_S": "90",
        "ML_OFFLINE_RETRIES": "5",
    }
    for name, value in variables.items():
        monkeypatch.setenv(name, value)
    timing = Tuning.load().timing
    configs = ClientConfigs(timing)

    def shape(config: Any) -> tuple[object, ...]:
        return (config.retries, config.connect_timeout, config.read_timeout)

    assert shape(configs.detectors()) == ({"total_max_attempts": 3, "mode": "standard"}, 1, 3)
    assert shape(configs.model_files()) == ({"total_max_attempts": 4, "mode": "standard"}, 6, 45)
    assert configs.offline().retries == {"max_attempts": 5, "mode": "adaptive"}
    assert configs.offline().read_timeout == 90
    assert JudgeTimeouts.of(timing) == JudgeTimeouts(10, 2, 3, 75)


def test_offline_scoring_keeps_its_patient_client_by_default() -> None:
    offline = ClientConfigs(Tuning.load().timing).offline()
    assert (offline.retries, offline.read_timeout) == ({"max_attempts": 8, "mode": "adaptive"}, 120)


def test_a_bad_variable_stops_the_app_before_it_serves(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ML_COMMUNITY_CHECK_MIN", "0.9")
    with pytest.raises(ConfigError, match="ML_COMMUNITY_CHECK_MIN must be below"):
        build_verify_router()
