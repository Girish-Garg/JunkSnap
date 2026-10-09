import pytest
from agent.domain.purposes import Purpose
from agent.domain.verification import SignalResult, Thresholds
from agent.services.combiner import FixedWeightCombiner

COMBINER = FixedWeightCombiner(Thresholds())
REPORT = Purpose.named("report")
CLEANUP = Purpose.named("cleanup")


def signal(name: str, score: float) -> SignalResult:
    return SignalResult(name, score, "rekognition", "DetectLabels", "3.0", 300)


@pytest.mark.parametrize(
    ("score", "decision"),
    [(0.95, "auto_verified"), (0.85, "auto_verified"), (0.84, "community_check"),
     (0.5, "community_check"), (0.49, "rejected"), (0.0, "rejected")],
)
def test_report_thresholds(score: float, decision: str) -> None:
    outcome = COMBINER.combine([signal("rekognition_labels", score)], REPORT)

    assert outcome.decision == decision
    assert outcome.is_clean is None


def test_probability_is_the_weighted_mean() -> None:
    signals = [signal("rekognition_labels", 0.7), signal("vision_judge", 0.95)]

    assert COMBINER.probability(signals) == pytest.approx((0.4 * 0.7 + 0.6 * 0.95) / 1.0)


def test_strong_disagreement_goes_to_community_check() -> None:
    signals = [signal("rekognition_labels", 0.95), signal("vision_judge", 0.1)]

    outcome = COMBINER.combine(signals, REPORT)

    assert outcome.disagreement is True
    assert outcome.decision == "community_check"


def test_strong_disagreement_beats_a_low_probability() -> None:
    signals = [signal("rekognition_labels", 0.6), signal("vision_judge", 0.05)]

    assert COMBINER.combine(signals, REPORT).decision == "community_check"


def test_mild_difference_is_not_disagreement() -> None:
    signals = [signal("rekognition_labels", 0.9), signal("vision_judge", 0.6)]

    assert COMBINER.disagree(signals) is False


@pytest.mark.parametrize(
    ("scores", "needed"),
    [((0.95,), False), ((0.2,), False), ((0.7,), True), ((0.9, 0.3), True)],
)
def test_judge_needed_only_when_unsure_or_split(scores: tuple[float, ...], needed: bool) -> None:
    names = ("rekognition_labels", "yolo")
    signals = [signal(name, score) for name, score in zip(names, scores, strict=False)]

    assert COMBINER.needs_judge(signals) is needed


@pytest.mark.parametrize(
    ("score", "decision", "clean"),
    [(0.9, "auto_verified", True), (0.7, "rejected", False), (0.1, "rejected", False)],
)
def test_cleanup_never_goes_to_community_check(score: float, decision: str, clean: bool) -> None:
    outcome = COMBINER.combine([signal("rekognition_labels", score)], CLEANUP)

    assert (outcome.decision, outcome.is_clean) == (decision, clean)


def test_cleanup_with_disagreement_is_rejected() -> None:
    signals = [signal("rekognition_labels", 0.95), signal("vision_judge", 0.95), signal("yolo", 0.2)]

    outcome = FixedWeightCombiner(Thresholds(0.6, 0.5)).combine(signals, CLEANUP)

    assert (outcome.decision, outcome.is_clean, outcome.disagreement) == ("rejected", False, True)
