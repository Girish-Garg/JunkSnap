import pytest
from fakes import FakeDetector, make_case

from ml.domain.label_insights import LabelInsights
from ml.domain.verification import Claim
from ml.services.label_signal import RekognitionLabelSignal


def label_signal(labels: dict[str, float]) -> RekognitionLabelSignal:
    return RekognitionLabelSignal(FakeDetector(labels), LabelInsights())


def test_strong_waste_label_scores_its_confidence() -> None:
    result = label_signal({"Garbage": 0.91, "Road": 0.99}).measure(make_case())

    assert result.score == pytest.approx(0.91)
    assert (result.name, result.provider, result.model, result.version) == (
        "rekognition_labels", "rekognition", "DetectLabels", "3.0"
    )
    assert result.notes == ("Garbage 0.91",)


def test_weak_label_counts_less() -> None:
    assert label_signal({"Plastic Bag": 0.9}).measure(make_case()).score == pytest.approx(0.54)


def test_no_matching_label_scores_zero() -> None:
    assert label_signal({"Road": 0.99, "Building": 0.95}).measure(make_case()).score == 0.0


def test_scores_the_claimed_report_type() -> None:
    claim = Claim("open_construction", "uncovered_debris")

    result = label_signal({"Rubble": 0.8, "Garbage": 0.3}).measure(make_case(claim=claim))

    assert result.score == pytest.approx(0.8)


def test_cleanup_support_is_one_minus_waste() -> None:
    assert label_signal({"Garbage": 0.9}).measure(make_case("cleanup")).score == pytest.approx(0.1)
