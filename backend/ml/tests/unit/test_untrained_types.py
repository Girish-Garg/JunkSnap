"""Claims the detectors were never trained on: the judge always runs and decides (field case)."""

from dataclasses import replace

import pytest
from fakes import JUDGE_JSON, FakeDetector, FixedClock, make_case, provider_error, scripted_judge
from model_fakes import FakeEmbedder, FakeObjectDetector, meta_v2, two_dim_heads

from ml.domain.case import VerificationResult
from ml.domain.label_insights import LabelInsights
from ml.domain.verification import Claim, Thresholds
from ml.ports.signal import Signal
from ml.services.embedding_signal import EmbeddingSignal
from ml.services.label_signal import RekognitionLabelSignal
from ml.services.meta_combiner import MetaLearnerCombiner
from ml.services.stacked_verifier import StackedVerifier
from ml.services.yolo_signal import YoloSignal

FLYOVER = Claim("open_construction", "dusty_site")


def answer(report_type: str, context: str, confidence: float) -> str:
    return (JUDGE_JSON.replace('"waste_dump"', f'"{report_type}"')
            .replace('"vacant_plot"', context).replace('0.9}', f'{confidence}}}'))


def signals(labels: dict[str, float]) -> list[Signal]:
    """Rekognition with these labels; YOLO finds no box; the embedding head sees waste."""
    return [
        RekognitionLabelSignal(FakeDetector(labels), LabelInsights()),
        YoloSignal(FakeObjectDetector([])),
        EmbeddingSignal(FakeEmbedder((1.0, 0.0)), two_dim_heads()),
    ]


def verify(
    claim: Claim, script: str | Exception, labels: dict[str, float]
) -> tuple[VerificationResult, int]:
    judge, provider = scripted_judge(script)
    combiner = MetaLearnerCombiner(meta_v2(), Thresholds())
    result = StackedVerifier(signals(labels), judge, combiner, FixedClock()).verify(
        make_case(claim=claim)
    )
    return result, len(provider.requests)


def test_the_flyover_report_goes_to_the_judge_and_is_not_rejected() -> None:
    """rpt_01m4k31nm7x7s2je74va23tjzg: Rekognition 0.3113, YOLO 0, embeddings 0.5, rejected."""
    result, asked = verify(FLYOVER, answer("open_construction", '"dusty_site"', 0.8),
                           {"Construction": 0.3113})
    scores = {s.name: s for s in result.signals}
    assert asked == 1 and result.judge is not None
    assert scores["yolo"].neutral and scores["embedding_classifier"].neutral
    assert scores["rekognition_labels"].score == pytest.approx(0.3113)
    assert result.combiner.kind == "fixed_weights"
    assert result.combiner.reason == (
        "meta-learner has no training rows for open_construction; judge decides"
    )
    assert result.outcome.probability == pytest.approx(0.4 * 0.3113 + 0.6 * 0.8)
    assert result.outcome.decision == "community_check" and result.outcome.veto is None


def test_a_sure_judge_and_matching_labels_auto_verify_an_untrained_type() -> None:
    result, _ = verify(FLYOVER, answer("open_construction", '"dusty_site"', 0.95),
                       {"Construction Site": 0.9, "Rubble": 0.9})
    assert result.outcome.decision == "auto_verified"


def test_contaminated_water_is_also_left_to_the_judge() -> None:
    claim = Claim("contaminated_water", "sewage")
    result, asked = verify(claim, answer("contaminated_water", '"sewage"', 0.8), {"Water": 0.5})
    assert asked == 1 and result.combiner.kind == "fixed_weights"
    assert result.outcome.decision == "community_check"


def test_a_judge_outage_on_an_untrained_type_goes_to_community_check() -> None:
    result, _ = verify(FLYOVER, provider_error(), {"Construction": 0.3113})
    assert result.judge is None
    assert (result.outcome.probability, result.outcome.decision) == (0.5, "community_check")


def test_a_judge_outage_with_no_matching_label_keeps_the_detectors_veto() -> None:
    result, _ = verify(FLYOVER, provider_error(), {"Sky": 0.9})
    assert result.outcome.decision == "rejected"
    assert result.outcome.veto is not None
    assert result.outcome.veto.reason == "detectors_veto:no_waste"


def test_a_confident_not_waste_still_vetoes_an_untrained_type() -> None:
    result, _ = verify(FLYOVER, answer("not_waste", "null", 0.9), {"Construction": 0.3113})
    assert result.outcome.decision == "rejected"
    assert result.outcome.veto is not None
    assert result.outcome.veto.reason == "judge_veto:not_waste"


def test_waste_dump_stays_on_the_meta_learner_with_the_judge_as_one_input() -> None:
    result, asked = verify(Claim("waste_dump", "roadside"), JUDGE_JSON, {"Garbage": 0.9})
    assert asked == 1 and result.combiner.kind == "meta_learner"
    assert result.combiner.reason is None
    assert [s.name for s in result.signals][-1] == "vision_judge"


def test_a_listed_type_still_hands_over_when_a_trained_signal_is_blind_to_it() -> None:
    listed = replace(meta_v2(), report_types=frozenset({"waste_dump", "open_construction"}))
    case = make_case(claim=FLYOVER)
    measured = [signal.measure(case) for signal in signals({"Construction": 0.3})]
    chosen = MetaLearnerCombiner(listed, Thresholds()).for_claim(FLYOVER, measured)
    assert chosen.info().reason == (
        "yolo, embedding_classifier not trained for open_construction; judge decides"
    )


def test_meta_v2_without_report_types_covers_only_what_it_was_fitted_on() -> None:
    model = meta_v2()
    assert {t for t in ("waste_dump", "no_bin", "open_construction", "contaminated_water",
                        "overflowing_bin") if model.covers(t)} == {"waste_dump", "no_bin"}
