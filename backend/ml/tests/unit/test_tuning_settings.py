"""Every ML tuning variable: today's value when unset, read by its exact name, bounded."""

import pytest

from ml.adapters import onnx_yolo, pillow_fitter, rekognition_labels
from ml.domain.errors import ConfigError
from ml.domain.insights import HAZARD_MIN
from ml.domain.label_insights import HAZARD_MIN_CONFIDENCE
from ml.domain.labels import WEAK_WEIGHT
from ml.domain.verification import Thresholds
from ml.domain.vetoes import VetoLimits
from ml.handlers.judge_timeouts import JudgeTimeouts
from ml.handlers.tuned_parts import TunedParts
from ml.services.combiner import DISAGREEMENT_GAP, FIXED_WEIGHTS
from ml.services.provider_router import AttemptPolicy
from ml.services.vision_judge import JudgeOptions
from ml.services.yolo_signal import YoloOptions
from ml.settings.tuning import Tuning

# Today's values; contracts/README.md lists the same.
TODAY: dict[str, object] = {
    "ML_AUTO_VERIFY_MIN": 0.85, "ML_COMMUNITY_CHECK_MIN": 0.5, "ML_DISAGREEMENT_GAP": 0.5,
    "ML_YOLO_LIFT_MIN": 0.5, "ML_DETECTORS_VETO_MAX": 0.2,
    "ML_WEIGHT_REKOGNITION_LABELS": 0.4, "ML_WEIGHT_YOLO": 0.3,
    "ML_WEIGHT_EMBEDDING_CLASSIFIER": 0.3, "ML_WEIGHT_VISION_JUDGE": 0.6,
    "ML_YOLO_MIN_CONFIDENCE": 0.25, "ML_YOLO_HAZARD_MIN": 0.5, "ML_YOLO_SIZE_BOX_MIN": 0.4,
    "ML_YOLO_SIZE_SMALL_MAX": 0.10, "ML_YOLO_SIZE_MEDIUM_MAX": 0.35, "ML_YOLO_BIN_REACH": 0.5,
    "ML_YOLO_BIN_ALONE_WEIGHT": 0.5, "ML_EMBEDDING_HAZARD_MIN": 0.5,
    "ML_LABEL_HAZARD_MIN": 0.6, "ML_LABEL_WEAK_WEIGHT": 0.6,
    "ML_REKOGNITION_MAX_LABELS": 50, "ML_REKOGNITION_MIN_CONFIDENCE": 0.5,
    "ML_JUDGE_MAX_TOKENS": 700, "ML_JUDGE_TEMPERATURE": 0.0,
    "ML_JUDGE_INVALID_ANSWER_RETRIES": 1, "ML_JUDGE_HAZARD_MIN": 0.5, "ML_JUDGE_BRANDS_MAX": 20,
    "ML_WORKER_BUDGET_S": 60.0, "ML_DETECTORS_BUDGET_S": 10.0,
    "ML_JUDGE_READ_TIMEOUT_S": 8.0, "ML_JUDGE_CONNECT_TIMEOUT_S": 3.0, "ML_JUDGE_ATTEMPTS": 2,
    "ML_AWS_READ_TIMEOUT_S": 4.0, "ML_AWS_CONNECT_TIMEOUT_S": 2.0, "ML_AWS_ATTEMPTS": 2,
    "ML_MODEL_DOWNLOAD_READ_TIMEOUT_S": 30.0, "ML_MODEL_DOWNLOAD_CONNECT_TIMEOUT_S": 5.0,
    "ML_MODEL_DOWNLOAD_ATTEMPTS": 3, "ML_OFFLINE_READ_TIMEOUT_S": 120.0, "ML_OFFLINE_RETRIES": 8,
    "ML_IMAGE_MAX_SIDE_PX": 2048, "ML_IMAGE_MAX_BYTES": 3_500_000,
    "ML_IMAGE_JPEG_QUALITIES": (90, 80, 70, 60, 50, 40),
}


def read(tuning: Tuning) -> dict[str, object]:
    """Every variable by its name, as the settings read it."""
    groups = (tuning.gates, tuning.signals, tuning.judge, tuning.timing, tuning.images)
    return {k: v for group in groups for k, v in group.model_dump(by_alias=True).items()}


def test_unset_variables_keep_todays_values() -> None:
    assert read(Tuning.load()) == TODAY


def test_unset_every_class_is_built_as_before_the_variables() -> None:
    tuning = Tuning.load()
    parts, signals = TunedParts(tuning), tuning.signals
    assert tuning.gates.thresholds() == Thresholds()
    assert tuning.gates.veto_limits() == VetoLimits()
    assert tuning.gates.fixed_weights() == FIXED_WEIGHTS
    assert tuning.gates.disagreement_gap == DISAGREEMENT_GAP
    assert parts.yolo_options() == YoloOptions()
    assert parts.judge_options() == JudgeOptions()
    assert parts.attempts(None) == AttemptPolicy()
    assert JudgeTimeouts.of(tuning.timing) == JudgeTimeouts()
    assert signals.yolo_min_confidence == onnx_yolo.MIN_CONFIDENCE
    assert signals.embedding_hazard_min == HAZARD_MIN
    assert (signals.label_hazard_min, signals.label_weak_weight) == (
        HAZARD_MIN_CONFIDENCE, WEAK_WEIGHT)
    assert (signals.rekognition_max_labels, signals.rekognition_min_confidence) == (
        rekognition_labels.MAX_LABELS, rekognition_labels.MIN_CONFIDENCE)
    images = tuning.images
    assert (images.max_side_px, images.max_bytes, images.jpeg_qualities) == (
        pillow_fitter.MAX_SIDE, pillow_fitter.MAX_BYTES, pillow_fitter.JPEG_QUALITIES)


def test_variables_are_read_by_their_exact_names(monkeypatch: pytest.MonkeyPatch) -> None:
    given = {
        "ML_AUTO_VERIFY_MIN": "0.9", "ML_COMMUNITY_CHECK_MIN": "0.4",
        "ML_WEIGHT_VISION_JUDGE": "1.2", "ML_YOLO_SIZE_MEDIUM_MAX": "0.5",
        "ML_REKOGNITION_MAX_LABELS": "25", "ML_JUDGE_INVALID_ANSWER_RETRIES": "0",
        "ML_JUDGE_READ_TIMEOUT_S": "6.5", "ML_IMAGE_JPEG_QUALITIES": "[85, 60]",
    }
    for name, value in given.items():
        monkeypatch.setenv(name, value)

    tuning = Tuning.load()

    assert tuning.gates.thresholds() == Thresholds(0.9, 0.4)
    assert tuning.gates.fixed_weights()["vision_judge"] == 1.2
    assert tuning.signals.yolo_size_medium_max == 0.5
    assert tuning.signals.rekognition_max_labels == 25
    assert tuning.judge.invalid_answer_retries == 0
    assert JudgeTimeouts.of(tuning.timing).read_s == 6.5
    assert tuning.images.jpeg_qualities == (85, 60)
    others = {name: value for name, value in read(tuning).items() if name not in given}
    assert others == {name: value for name, value in TODAY.items() if name not in given}


@pytest.mark.parametrize(
    ("name", "value"),
    [
        ("ML_AUTO_VERIFY_MIN", "1.5"),  # a probability above 1
        ("ML_COMMUNITY_CHECK_MIN", "-0.1"),
        ("ML_COMMUNITY_CHECK_MIN", "0.85"),  # not below auto-verify
        ("ML_DISAGREEMENT_GAP", "0"),
        ("ML_YOLO_LIFT_MIN", "high"),  # not a number
        ("ML_WEIGHT_YOLO", "-1"),
        ("ML_WEIGHT_VISION_JUDGE", "0"),  # the judge must weigh something
        ("ML_YOLO_SIZE_SMALL_MAX", "0.35"),  # not below medium
        ("ML_YOLO_BIN_REACH", "9"),
        ("ML_REKOGNITION_MAX_LABELS", "0"),
        ("ML_REKOGNITION_MIN_CONFIDENCE", "50"),  # 0..1, not Rekognition's percent
        ("ML_JUDGE_MAX_TOKENS", "0"),
        ("ML_JUDGE_TEMPERATURE", "2"),
        ("ML_JUDGE_INVALID_ANSWER_RETRIES", "-1"),
        ("ML_JUDGE_BRANDS_MAX", "1000"),
        ("ML_JUDGE_ATTEMPTS", "0"),
        ("ML_DETECTORS_BUDGET_S", "60"),  # leaves the judge no time
        ("ML_JUDGE_READ_TIMEOUT_S", "30"),  # 2 x 30 s is over the judge's 50 s
        ("ML_AWS_READ_TIMEOUT_S", "6"),  # 2 x 6 s is over the detectors' 10 s
        ("ML_MODEL_DOWNLOAD_READ_TIMEOUT_S", "0"),
        ("ML_OFFLINE_RETRIES", "-2"),
        ("ML_IMAGE_MAX_SIDE_PX", "100"),  # under SigLIP's 224 px
        ("ML_IMAGE_MAX_BYTES", "5000000"),  # over Bedrock's 3.75 MB
        ("ML_IMAGE_JPEG_QUALITIES", "[]"),
        ("ML_IMAGE_JPEG_QUALITIES", "[100, 90]"),
        ("ML_IMAGE_JPEG_QUALITIES", "90"),  # a list is JSON
    ],
)
def test_a_bad_value_stops_startup(monkeypatch: pytest.MonkeyPatch, name: str, value: str) -> None:
    monkeypatch.setenv(name, value)

    with pytest.raises(ConfigError):
        Tuning.load()
