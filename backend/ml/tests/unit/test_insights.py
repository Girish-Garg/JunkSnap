import pytest
from fakes import JUDGE_JSON, FakeDetector, make_case
from pydantic import ValidationError

from ml.domain.insights import HazardSighting, Insights, InsightSource, MaterialShare
from ml.domain.label_insights import LabelInsights
from ml.domain.labels import DetectedLabel
from ml.services.judge_answer import JudgeAnswer
from ml.services.label_signal import RekognitionLabelSignal

LABELS = InsightSource("rekognition_labels", "rekognition", "DetectLabels", "3.0")
JUDGE = InsightSource("vision_judge", "bedrock", "apac.amazon.nova-pro-v1:0", "v1:0")


def judge_json(hazards: str, burning: bool = False) -> str:
    return JUDGE_JSON.replace('"burning": false', f'"burning": {str(burning).lower()}').replace(
        '"confidence": 0.9}',
        '"confidence": 0.9, "composition": [{"material": "plastic", "share": 0.6},'
        ' {"material": "organic", "share": 0.2}], "size_class": "medium",'
        f' "hazards": {hazards}, "count": 40}}',
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
    e_waste = '[{"hazard": "e_waste", "confidence": 0.7}]'
    answer = JudgeAnswer.model_validate_json(judge_json(e_waste))

    insights = answer.to_insights(JUDGE)

    assert [(s.material, s.share) for s in insights.composition] == [
        ("plastic", pytest.approx(0.6)), ("organic", pytest.approx(0.2))
    ]
    assert insights.size_class is not None and insights.size_class.value == "medium"
    assert insights.hazards == (HazardSighting("e_waste", 0.7, JUDGE),)


def test_judge_burning_comes_with_its_own_confidence() -> None:
    hazards = '[{"hazard": "burning", "confidence": 0.8}]'

    insights = JudgeAnswer.model_validate_json(judge_json(hazards, burning=True)).to_insights(JUDGE)

    assert insights.hazards == (HazardSighting("burning", 0.8, JUDGE),)


@pytest.mark.parametrize(
    ("hazards", "burning"),
    [
        ("[]", True),
        ('[{"hazard": "burning", "confidence": 0.8}]', False),
        ('[{"hazard": "e_waste"}]', False),
        ('["e_waste"]', False),
    ],
)
def test_judge_hazards_without_their_own_confidence_are_invalid(
    hazards: str, burning: bool
) -> None:
    with pytest.raises(ValidationError):
        JudgeAnswer.model_validate_json(judge_json(hazards, burning))


def test_judge_measurements_win_and_labels_fill_the_rest() -> None:
    from_labels = Insights(
        (MaterialShare("paper", 0.6, LABELS), MaterialShare("plastic", 0.4, LABELS)),
        hazards=(HazardSighting("e_waste", 0.9, LABELS), HazardSighting("burning", 0.7, LABELS)),
    )
    from_judge = Insights(
        (MaterialShare("plastic", 0.5, JUDGE), MaterialShare("organic", 0.3, JUDGE)), None,
        (HazardSighting("e_waste", 0.5, JUDGE),), decides_burning=True,
    )

    merged = from_labels.merged_with(from_judge)

    assert [(s.material, round(s.share, 2), s.source) for s in merged.composition] == [
        ("plastic", 0.5, JUDGE), ("organic", 0.3, JUDGE), ("paper", 0.2, LABELS)
    ]
    assert merged.hazards == (HazardSighting("e_waste", 0.5, JUDGE),)


def test_without_a_judge_label_shares_and_burning_stay() -> None:
    from_labels = Insights((MaterialShare("paper", 1.0, LABELS),),
                           hazards=(HazardSighting("burning", 0.7, LABELS),))

    merged = from_labels.merged_with(Insights())

    assert merged.composition == from_labels.composition
    assert merged.burning is True


def test_merged_shares_never_pass_100_percent() -> None:
    from_labels = Insights((MaterialShare("plastic", 1.0, LABELS),))
    from_judge = Insights((MaterialShare("organic", 0.5, JUDGE),))

    merged = from_labels.merged_with(from_judge)

    assert [(s.material, s.share) for s in merged.composition] == [
        ("organic", 0.5), ("plastic", 0.5)
    ]
