import pytest
from fakes import JUDGE_JSON, FakeDetector, make_case

from ml.domain.insights import Insights, MaterialShare
from ml.domain.label_insights import LabelInsights
from ml.domain.labels import DetectedLabel
from ml.services.judge_answer import JudgeAnswer
from ml.services.label_signal import RekognitionLabelSignal

JUDGE_WITH_INSIGHTS = JUDGE_JSON.replace(
    '"confidence": 0.9}',
    '"confidence": 0.9, "composition": [{"material": "plastic", "share": 0.6},'
    ' {"material": "organic", "share": 0.2}], "size_class": "medium",'
    ' "hazards": ["e_waste", "burning"], "count": 40}',
)


def labels(**confidences: float) -> tuple[DetectedLabel, ...]:
    return tuple(DetectedLabel(name.replace("_", " "), c) for name, c in confidences.items())


def test_label_composition_shares_sum_to_one() -> None:
    insights = LabelInsights().read(labels(Plastic_Bag=0.9, Food=0.3, Road=0.99))

    assert [(s.material, round(s.share, 2)) for s in insights.composition] == [
        ("plastic", 0.75), ("organic", 0.25)
    ]
    assert {s.source for s in insights.composition} == {"rekognition_labels"}
    assert insights.size_class is None


def test_confident_smoke_label_means_burning_and_weak_hazards_are_ignored() -> None:
    insights = LabelInsights().read(labels(Smoke=0.8, Syringe=0.4))

    assert insights.burning is True
    assert insights.hazards == frozenset()


def test_no_smoke_label_leaves_burning_unknown() -> None:
    assert LabelInsights().read(labels(Garbage=0.9)).burning is None


def test_signal_carries_label_insights() -> None:
    detector = FakeDetector({"Garbage": 0.9, "Cardboard": 0.8})
    signal = RekognitionLabelSignal(detector, LabelInsights())

    insights = signal.measure(make_case()).insights

    assert [s.material for s in insights.composition] == ["paper"]


def test_judge_insights_are_normalised_and_ignore_counts() -> None:
    insights = JudgeAnswer.model_validate_json(JUDGE_WITH_INSIGHTS).to_insights()

    assert [(s.material, s.share) for s in insights.composition] == [
        ("plastic", pytest.approx(0.75)), ("organic", pytest.approx(0.25))
    ]
    assert insights.size_class == "medium"
    assert insights.hazards == frozenset({"e_waste"})


def test_judge_burning_field_decides_burning() -> None:
    assert JudgeAnswer.model_validate_json(JUDGE_WITH_INSIGHTS).to_insights().burning is False


def test_judge_burning_verdict_replaces_the_label_one() -> None:
    from_labels = Insights((MaterialShare("paper", 1.0, "rekognition_labels"),), burning=True)
    from_judge = Insights((MaterialShare("plastic", 1.0, "vision_judge"),), "small",
                          frozenset({"chemicals"}), burning=False)

    merged = from_labels.merged_with(from_judge)

    assert merged.to_contract() == {
        "composition": [{"material": "plastic", "share": 1.0, "source": "vision_judge"}],
        "size_class": "small",
        "hazards": ["chemicals"],
        "burning": False,
    }


def test_without_a_judge_the_label_burning_stays() -> None:
    from_labels = Insights((MaterialShare("paper", 1.0, "rekognition_labels"),), burning=True)

    merged = from_labels.merged_with(Insights())

    assert merged.composition == from_labels.composition
    assert merged.to_contract()["hazards"] == ["burning"]
    assert merged.burning is True
