import pytest
from fakes import make_case
from model_fakes import FakeEmbedder, FakeObjectDetector, two_dim_heads

from ml.domain.errors import ConfigError
from ml.domain.verification import Claim
from ml.services.embedding_signal import EmbeddingSignal
from ml.services.yolo_signal import YoloSignal


def test_yolo_scores_the_best_waste_box_and_names_its_model() -> None:
    detector = FakeObjectDetector([("waste_pile", 0.8, 0.2), ("bin", 0.95, 0.05)])
    result = YoloSignal(detector).measure(make_case())
    assert result.score == pytest.approx(0.8)
    assert (result.name, result.provider, result.version) == ("yolo", "junksnap", "yolo26s-v1")
    assert result.to_contract()["model"] == "junksnap-yolo26"


def test_yolo_size_class_follows_the_share_under_waste_boxes() -> None:
    sizes = []
    for share in (0.05, 0.2, 0.6):
        result = YoloSignal(FakeObjectDetector([("waste_pile", 0.9, share)])).measure(make_case())
        assert result.insights.size_class is not None
        sizes.append(result.insights.size_class.value)
    assert sizes == ["small", "medium", "large"]
    empty = YoloSignal(FakeObjectDetector([])).measure(make_case())
    assert empty.insights.size_class is None and empty.score == 0.0


def test_yolo_reports_burning_and_flips_for_cleanups() -> None:
    detector = FakeObjectDetector([("burning", 0.7, 0.1), ("waste_item", 0.9, 0.01)])
    report = YoloSignal(detector).measure(make_case())
    assert [h.hazard for h in report.insights.hazards] == ["burning"]
    cleanup = YoloSignal(detector).measure(make_case("cleanup"))
    assert cleanup.score == pytest.approx(0.1)


def test_yolo_is_neutral_on_claims_it_cannot_see() -> None:
    case = make_case(claim=Claim("contaminated_water", "sewage"))
    result = YoloSignal(FakeObjectDetector([("waste_pile", 0.9, 0.2)])).measure(case)
    assert result.score == 0.5 and result.notes == ("no class for contaminated_water",)


def test_embedding_signal_scores_waste_and_reads_composition() -> None:
    signal = EmbeddingSignal(FakeEmbedder((1.0, 0.0)), two_dim_heads())
    result = signal.measure(make_case())
    assert result.score > 0.95
    assert result.to_contract()["version"] == "amazon.titan-embed-image-v1/clf-test"
    shares = {s.material: s.share for s in result.insights.composition}
    assert shares == {"plastic": pytest.approx(1.0)}
    assert result.insights.composition[0].source.signal == "embedding_classifier"
    assert [h.hazard for h in result.insights.hazards] == ["burning"]


def test_embedding_signal_without_waste_and_on_other_claims() -> None:
    clean = EmbeddingSignal(FakeEmbedder((0.0, 1.0)), two_dim_heads()).measure(make_case())
    assert clean.score < 0.05 and clean.insights.hazards == ()
    assert clean.insights.composition == ()
    water = make_case(claim=Claim("contaminated_water", "sewage"))
    neutral = EmbeddingSignal(FakeEmbedder((1.0, 0.0)), two_dim_heads()).measure(water)
    assert neutral.score == 0.5


def test_embedding_signal_refuses_vectors_from_another_model() -> None:
    signal = EmbeddingSignal(FakeEmbedder((1.0, 0.0), model="other"), two_dim_heads())
    with pytest.raises(ConfigError):
        signal.measure(make_case())
