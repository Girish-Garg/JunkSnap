import pytest
from model_fakes import meta_model, meta_v2

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


def test_confident_agreement_with_the_judge_is_decided() -> None:
    sure = signals(0.9, 0.9, 0.9, judge=0.9)
    assert combiner().combine(sure, REPORT).decision == "auto_verified"
    assert combiner().combine(signals(0.1, 0.1, 0.1, judge=0.1), REPORT).decision == "rejected"


def test_without_the_judge_sure_detectors_only_reach_community_check() -> None:
    outcome = combiner().combine(signals(0.99, 0.99, 0.99), REPORT)
    assert outcome.probability > 0.85 and outcome.decision == "community_check"


def test_the_judged_model_takes_over_when_the_judge_answers() -> None:
    judged = combiner().combine(signals(0.6, 0.55, 0.5, judge=0.95), REPORT)
    assert judged.probability > 0.85 and judged.decision == "auto_verified"


def test_cleanup_support_is_mapped_to_waste_and_back() -> None:
    clean = signals(0.9, 0.9, 0.9)
    as_report = combiner().probability(clean, REPORT)
    assert combiner().probability(clean, CLEANUP) == pytest.approx(as_report)


def test_without_every_trained_signal_the_rekognition_fallback_decides() -> None:
    raw = {
        "version": "m",
        "base": {"signals": ["rekognition_labels", "yolo"], "weights": [1.0, 1.0], "bias": 3.0},
        "judged": {"signals": ["yolo"], "weights": [1.0], "bias": 0.0},
        "fallback": {"signals": ["rekognition_labels"], "weights": [2.0], "bias": -1.0},
        "fallback_judged": {"signals": ["rekognition_labels"], "weights": [1.0], "bias": 0.0},
    }
    model = MetaModel.from_json(raw)
    assert model.pick(frozenset({"rekognition_labels"}), judged=False) is model.fallback
    assert model.pick(frozenset({"rekognition_labels", "yolo"}), judged=False) is model.base
    only_labels = MetaLearnerCombiner(model, Thresholds())
    assert only_labels.probability(signals(0.5), REPORT) == pytest.approx(Logistic.sigmoid(-1.0))


def test_without_rekognition_the_full_model_reads_it_at_its_neutral_score() -> None:
    """Training fills a missing score with 0.5 (logit 0, stacker._fit), so YOLO, the embedding
    and the judge still count; the Rekognition-only fallback is for a missing YOLO or embedding.
    """
    model = meta_v2()
    rest = frozenset({"yolo", "embedding_classifier"})
    assert model.pick(rest | {"vision_judge"}, judged=True) is model.judged
    assert model.pick(rest, judged=False) is model.base
    labels_and_judge = frozenset({"rekognition_labels", "vision_judge"})
    assert model.pick(labels_and_judge | {"yolo"}, judged=True) is model.fallback_judged
    judge = SignalResult("vision_judge", 0.9, "bedrock", "nova", "1", 900)
    neutral = signals(0.5, 0.9, 0.9, judge=0.9)
    without = [*neutral[1:3], judge]
    meta = MetaLearnerCombiner(model, Thresholds())
    assert meta.probability(without, REPORT) == pytest.approx(meta.probability(neutral, REPORT))


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
