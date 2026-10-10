import pytest
from model_fakes import meta_model

from ml.domain.errors import ConfigError
from ml.domain.linear import EmbeddingHeads, Logistic, MetaModel, SignalLogistic
from ml.domain.purposes import Purpose
from ml.domain.verification import SignalResult, Thresholds
from ml.services.meta_combiner import MetaLearnerCombiner

REPORT = Purpose.named("report")
CLEANUP = Purpose.named("cleanup")


def signals(*scores: float, judge: float | None = None) -> list[SignalResult]:
    names = ("rekognition_labels", "yolo", "embedding_classifier")
    pairs = zip(names, scores, strict=False)
    made = [SignalResult(n, s, "junksnap", "m", "1", 10) for n, s in pairs]
    if judge is not None:
        made.append(SignalResult("vision_judge", judge, "bedrock", "nova", "1", 900))
    return made


def combiner() -> MetaLearnerCombiner:
    return MetaLearnerCombiner(meta_model(), Thresholds())


def test_meta_learner_adds_signal_logits() -> None:
    expected = Logistic.sigmoid(3 * Logistic.logit(0.8))
    assert combiner().probability(signals(0.8, 0.8, 0.8), REPORT) == pytest.approx(expected)
    assert combiner().info().kind == "meta_learner"
    assert combiner().info().version == "meta-test"


def test_confident_agreement_is_decided_without_the_judge() -> None:
    sure = signals(0.9, 0.9, 0.9)
    assert not combiner().needs_judge(sure, REPORT)
    assert combiner().combine(sure, REPORT).decision == "auto_verified"
    assert combiner().combine(signals(0.1, 0.1, 0.1), REPORT).decision == "rejected"


def test_unsure_or_split_signals_ask_the_judge_and_its_model_takes_over() -> None:
    assert combiner().needs_judge(signals(0.6, 0.55, 0.5), REPORT)
    assert combiner().needs_judge(signals(0.95, 0.2, 0.9), REPORT)
    judged = combiner().combine(signals(0.6, 0.55, 0.5, judge=0.95), REPORT)
    assert judged.probability > 0.85 and judged.decision == "auto_verified"


def test_cleanup_support_is_mapped_to_waste_and_back() -> None:
    clean = signals(0.9, 0.9, 0.9)
    as_report = combiner().probability(clean, REPORT)
    assert combiner().probability(clean, CLEANUP) == pytest.approx(as_report)
    assert combiner().needs_judge(clean, CLEANUP)


def test_missing_signals_add_nothing() -> None:
    model = SignalLogistic(("yolo", "vision_judge"), (2.0, 2.0), 0.0)
    assert model.probability({"yolo": 0.5}) == pytest.approx(0.5)


def test_bad_model_files_are_config_errors() -> None:
    with pytest.raises(ConfigError):
        MetaModel.from_json({"version": "x", "base": {"signals": ["a"], "weights": [], "bias": 0},
                             "judged": {"signals": [], "weights": [], "bias": 0}})
    with pytest.raises(ConfigError):
        EmbeddingHeads.from_json({"version": "x", "embedder": "e", "dim": 3, "groups": {
            "report_type": {"classes": ["w"], "weights": [[1.0]], "biases": [0.0]}}})
