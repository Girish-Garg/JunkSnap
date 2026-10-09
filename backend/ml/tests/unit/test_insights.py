import pytest
from fakes import JUDGE_JSON, FakeDetector, make_case

from ml.domain.insights import HazardSighting, Insights, InsightSource, MaterialShare
from ml.domain.label_insights import LabelInsights
from ml.domain.labels import DetectedLabel
from ml.services.judge_answer import JudgeAnswer
from ml.services.label_signal import RekognitionLabelSignal

LABELS = InsightSource("rekognition_labels", "rekognition", "DetectLabels", "3.0")
JUDGE = InsightSource("vision_judge", "bedrock", "apac.amazon.nova-pro-v1:0", "v1:0")
JUDGE_WITH_INSIGHTS = JUDGE_JSON.replace(
    '"confidence": 0.9}',
    '"confidence": 0.9, "composition": [{"material": "plastic", "share": 0.6},'
    ' {"material": "organic", "share": 0.2}], "size_class": "medium",'
    ' "hazards": [{"hazard": "e_waste", "confidence": 0.7},'
    ' {"hazard": "burning", "confidence": 0.8}], "count": 40}',
)


def labels(**confidences: float) -> tuple[DetectedLabel, ...]:
    return tuple(DetectedLabel(name.replace("_", " "), c) for name, c in confidences.items())


def test_label_composition_is_relative_and_names_its_model() -> None:
    insights = LabelInsights().read(labels(Plastic_Bag=0.9, Food=0.3, Road=0.99), LABELS)

    assert [share.to_contract() for share in insights.composition] == [
        {"material": "plastic", "share_pct": 75.0, "source": LABELS.to_contract()},
        {"material": "organic", "share_pct": 25.0, "source": LABELS.to_contract()},
    ]
    assert insights.size_class is None


def test_confident_hazard_labels_only() -> None:
    insights = LabelInsights().read(labels(Smoke=0.8, Syringe=0.4), LABELS)

    assert insights.hazards == (HazardSighting("burning", 0.8, LABELS),)


def test_signal_carries_label_insights() -> None:
    detector = FakeDetector({"Garbage": 0.9, "Cardboard": 0.8})
    signal = RekognitionLabelSignal(detector, LabelInsights())

    insights = signal.measure(make_case()).insights

    assert [(s.material, s.source) for s in insights.composition] == [("paper", LABELS)]


def test_judge_shares_keep_the_unknown_rest_and_ignore_counts() -> None:
    insights = JudgeAnswer.model_validate_json(JUDGE_WITH_INSIGHTS).to_insights(JUDGE)

    assert [(s.material, s.share) for s in insights.composition] == [
        ("plastic", pytest.approx(0.6)), ("organic", pytest.approx(0.2))
    ]
    assert insights.size_class is not None and insights.size_class.value == "medium"


def test_judge_burning_field_decides_burning() -> None:
    insights = JudgeAnswer.model_validate_json(JUDGE_WITH_INSIGHTS).to_insights(JUDGE)

    assert [h.hazard for h in insights.hazards] == ["e_waste"]
    assert insights.decides_burning is True


def test_judge_burning_uses_its_listed_confidence() -> None:
    burning = JUDGE_WITH_INSIGHTS.replace('"burning": false', '"burning": true')

    insights = JudgeAnswer.model_validate_json(burning).to_insights(JUDGE)

    assert HazardSighting("burning", 0.8, JUDGE) in insights.hazards


def test_earlier_sources_win_and_the_judge_fills_gaps() -> None:
    from_labels = Insights((MaterialShare("paper", 0.7, LABELS),),
                           hazards=(HazardSighting("e_waste", 0.9, LABELS),))
    from_judge = Insights(
        (MaterialShare("paper", 0.2, JUDGE), MaterialShare("plastic", 0.3, JUDGE)),
        None, (HazardSighting("e_waste", 0.5, JUDGE), HazardSighting("chemicals", 0.6, JUDGE)),
    )

    merged = from_labels.merged_with(from_judge)

    assert [(s.material, s.source) for s in merged.composition] == [
        ("paper", LABELS), ("plastic", JUDGE)
    ]
    assert {(h.hazard, h.source) for h in merged.hazards} == {
        ("e_waste", LABELS), ("chemicals", JUDGE)
    }


def test_judge_saying_no_fire_removes_label_burning() -> None:
    from_labels = Insights(hazards=(HazardSighting("burning", 0.7, LABELS),))
    no_fire = Insights(decides_burning=True)

    assert from_labels.merged_with(no_fire).burning is False
    assert from_labels.merged_with(Insights()).burning is True


def test_merged_shares_never_pass_100_percent() -> None:
    from_labels = Insights((MaterialShare("plastic", 1.0, LABELS),))
    from_judge = Insights((MaterialShare("organic", 0.5, JUDGE),))

    merged = from_labels.merged_with(from_judge)

    assert sum(share.share for share in merged.composition) == pytest.approx(1.0)
