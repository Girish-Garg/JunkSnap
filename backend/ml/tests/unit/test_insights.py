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
    ' "hazards": ["e_waste"], "count": 40}',
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


def test_confident_hazard_labels_only() -> None:
    insights = LabelInsights().read(labels(Smoke=0.8, Syringe=0.4))

    assert insights.hazards == frozenset({"burning"})
    assert insights.burning is True


def test_signal_carries_label_insights() -> None:
    signal = RekognitionLabelSignal(FakeDetector({"Garbage": 0.9, "Cardboard": 0.8}))

    insights = signal.measure(make_case()).insights

    assert [s.material for s in insights.composition] == ["paper"]


def test_judge_insights_are_normalised_and_ignore_counts() -> None:
    answer = JudgeAnswer.model_validate_json(JUDGE_WITH_INSIGHTS)

    insights = answer.to_insights()

    assert [(s.material, s.share) for s in insights.composition] == [
        ("plastic", pytest.approx(0.75)), ("organic", pytest.approx(0.25))
    ]
    assert insights.size_class == "medium"
    assert insights.hazards == frozenset({"e_waste"})


def test_judge_burning_adds_the_burning_hazard() -> None:
    burning = JUDGE_JSON.replace('"burning": false', '"burning": true')

    answer = JudgeAnswer.model_validate_json(burning)

    assert answer.to_insights().burning is True


def test_later_source_wins_composition_and_hazards_add_up() -> None:
    labels_view = Insights((MaterialShare("paper", 1.0, "rekognition_labels"),), None,
                           frozenset({"burning"}))
    judge_view = Insights((MaterialShare("plastic", 1.0, "vision_judge"),), "small",
                          frozenset({"chemicals"}))

    merged = labels_view.merged_with(judge_view)

    assert merged.to_contract() == {
        "composition": [{"material": "plastic", "share": 1.0, "source": "vision_judge"}],
        "size_class": "small",
        "hazards": ["burning", "chemicals"],
        "burning": True,
    }


def test_empty_later_source_keeps_earlier_composition() -> None:
    labels_view = Insights((MaterialShare("paper", 1.0, "rekognition_labels"),))

    assert labels_view.merged_with(Insights()).composition == labels_view.composition
