import pytest
from fakes import FakeBuilder, FakeProvider, FakeSignal, FixedClock, make_case
from model_fakes import FakeEmbedder, FakeObjectDetector, meta_model, two_dim_heads

from ml.domain.case import VerificationCase
from ml.domain.embedding import Embedding
from ml.domain.errors import ExternalServiceError
from ml.domain.llm import TaskConfig
from ml.domain.pricing import PriceTable
from ml.domain.verification import Claim, SignalResult, Thresholds
from ml.ports.embedding_sink import EmbeddingSink
from ml.ports.signal import Signal
from ml.services.embedding_signal import EmbeddingSignal
from ml.services.meta_combiner import MetaLearnerCombiner
from ml.services.provider_factory import ProviderFactory
from ml.services.provider_router import ProviderRouter
from ml.services.stacked_verifier import StackedVerifier
from ml.services.vision_judge import VisionJudge
from ml.services.yolo_signal import YoloSignal


class BrokenSignal(Signal):
    def measure(self, case: VerificationCase) -> SignalResult:
        raise ExternalServiceError("onnx failed")


class Sink(EmbeddingSink):
    def __init__(self, fail: bool) -> None:
        self._fail = fail

    def store(self, case_id: str, embedding: Embedding) -> str:
        if self._fail:
            raise ExternalServiceError("s3 down")
        return f"embeddings/{case_id}.json"


def verifier(signals: list[Signal]) -> StackedVerifier:
    provider = FakeProvider("nova", [])
    router = ProviderRouter({"judge": TaskConfig("bedrock", "nova")},
                            ProviderFactory({"bedrock": FakeBuilder({"nova": provider})}),
                            PriceTable())
    combiner = MetaLearnerCombiner(meta_model(), Thresholds())
    return StackedVerifier(signals, VisionJudge(router, "system"), combiner, FixedClock())


def test_a_signal_that_cannot_see_the_claim_never_counts_as_disagreement() -> None:
    case = make_case(claim=Claim("open_construction", "uncovered_debris"))
    yolo = YoloSignal(FakeObjectDetector([])).measure(case)
    embedding = EmbeddingSignal(FakeEmbedder((1.0, 0.0)), two_dim_heads()).measure(case)
    assert embedding.neutral and not yolo.neutral and yolo.score == 0.0
    combiner = MetaLearnerCombiner(meta_model(), Thresholds())
    assert not combiner.disagree([yolo, embedding])


def test_a_failing_signal_is_skipped_and_the_rest_decide() -> None:
    result = verifier([BrokenSignal(), FakeSignal("yolo", 0.99), FakeSignal("rekognition_labels",
                                                                          0.99)]).verify(make_case())
    assert [s.name for s in result.signals] == ["yolo", "rekognition_labels"]
    assert result.outcome.decision == "auto_verified"


def test_when_every_signal_fails_the_error_stands() -> None:
    with pytest.raises(ExternalServiceError):
        verifier([BrokenSignal()]).verify(make_case())


def test_the_embedding_key_is_set_unless_the_write_fails() -> None:
    stored = EmbeddingSignal(FakeEmbedder((1.0, 0.0)), two_dim_heads(), Sink(fail=False))
    assert stored.measure(make_case()).artifact_key == "embeddings/rpt_jdh_1.json"
    lost = EmbeddingSignal(FakeEmbedder((1.0, 0.0)), two_dim_heads(), Sink(fail=True))
    result = lost.measure(make_case())
    assert result.artifact_key is None and result.score > 0.9
