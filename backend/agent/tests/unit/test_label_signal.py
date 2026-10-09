import pytest
from agent.domain.verification import Claim
from agent.services.label_signal import RekognitionLabelSignal
from fakes import FakeDetector, make_case


def test_strong_waste_label_scores_its_confidence() -> None:
    signal = RekognitionLabelSignal(FakeDetector({"Garbage": 0.91, "Road": 0.99}))

    result = signal.measure(make_case())

    assert result.score == pytest.approx(0.91)
    assert (result.name, result.provider, result.model, result.version) == (
        "rekognition_labels", "rekognition", "DetectLabels", "3.0"
    )
    assert result.notes == ("Garbage 0.91",)


def test_weak_label_counts_less() -> None:
    signal = RekognitionLabelSignal(FakeDetector({"Plastic Bag": 0.9}))

    assert signal.measure(make_case()).score == pytest.approx(0.54)


def test_no_matching_label_scores_zero() -> None:
    signal = RekognitionLabelSignal(FakeDetector({"Road": 0.99, "Building": 0.95}))

    assert signal.measure(make_case()).score == 0.0


def test_scores_the_claimed_report_type() -> None:
    signal = RekognitionLabelSignal(FakeDetector({"Rubble": 0.8, "Garbage": 0.3}))
    claim = Claim("open_construction", "uncovered_debris")

    assert signal.measure(make_case(claim=claim)).score == pytest.approx(0.8)


def test_cleanup_support_is_one_minus_waste() -> None:
    signal = RekognitionLabelSignal(FakeDetector({"Garbage": 0.9}))

    assert signal.measure(make_case("cleanup")).score == pytest.approx(0.1)


def test_burning_labels_become_notes_not_score() -> None:
    signal = RekognitionLabelSignal(FakeDetector({"Smoke": 0.8}))

    result = signal.measure(make_case())

    assert result.score == 0.0
    assert result.notes == ("burning? Smoke 0.80",)
