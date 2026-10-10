"""Issue 103: a strong "no" from the judge, or from every detector, rejects the report photo."""

import json
from dataclasses import replace
from pathlib import Path

import pytest
from fakes import (
    JUDGE_JSON,
    FakeBuilder,
    FakeProvider,
    FakeSignal,
    FixedClock,
    make_case,
    provider_error,
)
from jsonschema import Draft202012Validator
from model_fakes import meta_model

from ml.domain.case import VerificationResult
from ml.domain.llm import TaskConfig
from ml.domain.pricing import PriceTable
from ml.domain.purposes import ReportPurpose
from ml.domain.verification import Claim, SignalResult, Thresholds
from ml.domain.vetoes import DetectorsDenyJudgeUnsure, VetoEvidence
from ml.ports.signal import Signal
from ml.services.combiner import FixedWeightCombiner
from ml.services.combiner_base import Combiner
from ml.services.meta_combiner import MetaLearnerCombiner
from ml.services.provider_factory import ProviderFactory
from ml.services.provider_router import ProviderRouter
from ml.services.stacked_verifier import StackedVerifier
from ml.services.vision_judge import VisionJudge

NOVA_LITE = "apac.amazon.nova-lite-v1:0"
SCHEMAS = Path(__file__).resolve().parents[4] / "contracts" / "schemas"
SCHEMA = json.loads((SCHEMAS / "verification_result.schema.json").read_text("utf-8"))
# A low community bar keeps weak detector scores unsure, so the judge runs.
ASKS_THE_JUDGE = FixedWeightCombiner(Thresholds(0.85, 0.01))
INDOOR_ROOM = (
    '{"report_type": "not_waste", "context": null, "burning": false, "readable_brands": [], '
    '"rationale": "The photo shows an indoor scene with furniture and household items, '
    'not waste.", "confidence": 0.95}'
)


def judged(report_type: str, context: str, confidence: float) -> str:
    return (
        JUDGE_JSON.replace('"waste_dump"', f'"{report_type}"')
        .replace('"vacant_plot"', f'"{context}"')
        .replace('"confidence": 0.9', f'"confidence": {confidence}')
    )


def prod_signals() -> list[Signal]:
    """The signals stored for the indoor-room report: YOLO 0, embeddings 0.77, labels unsure."""
    return [
        FakeSignal("rekognition_labels", 0.55), FakeSignal("yolo", 0.0),
        FakeSignal("embedding_classifier", 0.77),
    ]


def verify(
    signals: list[Signal], answers: list[str | Exception], combiner: Combiner | None = None,
    claim: Claim | None = None,
) -> VerificationResult:
    provider = FakeProvider(NOVA_LITE, answers)
    factory = ProviderFactory({"bedrock": FakeBuilder({NOVA_LITE: provider})})
    router = ProviderRouter({"judge": TaskConfig("bedrock", NOVA_LITE)}, factory, PriceTable())
    chosen = combiner or FixedWeightCombiner(Thresholds())
    stacked = StackedVerifier(signals, VisionJudge(router, "prompt"), chosen, FixedClock())
    return stacked.verify(make_case(claim=claim))


@pytest.mark.parametrize(
    "combiner", [FixedWeightCombiner(Thresholds()), MetaLearnerCombiner(meta_model(), Thresholds())]
)
def test_indoor_room_judged_not_waste_is_rejected_despite_disagreement(combiner: Combiner) -> None:
    result = verify(prod_signals(), [INDOOR_ROOM], combiner)

    assert result.signals[-1].score == pytest.approx(0.05)
    assert result.outcome.disagreement is True
    assert result.outcome.decision == "rejected"
    assert result.outcome.veto is not None and result.outcome.veto.reason == "judge_veto:not_waste"
    contract = result.to_contract()
    assert contract["decision"] == "rejected"
    assert f"+judge_veto:not_waste by bedrock/{NOVA_LITE}@4.6" in str(contract["combiner"])
    Draft202012Validator(SCHEMA).validate(contract)


def test_without_the_veto_the_same_photo_went_to_community_check() -> None:
    provider = FakeProvider(NOVA_LITE, [INDOOR_ROOM])
    factory = ProviderFactory({"bedrock": FakeBuilder({NOVA_LITE: provider})})
    router = ProviderRouter({"judge": TaskConfig("bedrock", NOVA_LITE)}, factory, PriceTable())
    stacked = StackedVerifier(
        prod_signals(), VisionJudge(router, "p"), FixedWeightCombiner(Thresholds()), FixedClock()
    )
    case = replace(make_case(), purpose=ReportPurpose(vetoes=()))
    assert stacked.verify(case).outcome.decision == "community_check"


def test_judge_with_almost_no_support_for_the_claimed_type_vetoes() -> None:
    result = verify(prod_signals(), [judged("waste_dump", "vacant_plot", 0.1)])

    assert result.outcome.decision == "rejected"
    assert result.outcome.veto is not None
    assert result.outcome.veto.reason == "judge_veto:low_support"


@pytest.mark.parametrize(
    ("claim", "answer"),
    [
        (Claim("overflowing_bin", "overflowing"), judged("overflowing_bin", "overflowing", 0.6)),
        (Claim("overflowing_bin", "damaged"), judged("waste_dump", "roadside", 0.9)),
        (Claim("no_bin", "no_pickup"), judged("no_bin", "no_pickup", 0.6)),
    ],
)
def test_judge_backing_the_claim_or_another_type_never_vetoes(claim: Claim, answer: str) -> None:
    result = verify(prod_signals(), [answer], claim=claim)

    assert result.outcome.veto is None
    assert result.outcome.decision == "community_check"


@pytest.mark.parametrize("claim", [Claim("overflowing_bin", "damaged"), Claim("no_bin", "no_bin")])
def test_not_waste_vetoes_every_claimed_type(claim: Claim) -> None:
    result = verify(prod_signals(), [INDOOR_ROOM], claim=claim)

    assert result.outcome.decision == "rejected"


def test_every_detector_no_and_an_unsure_judge_is_rejected() -> None:
    signals: list[Signal] = [FakeSignal("yolo", 0.0), FakeSignal("embedding_classifier", 0.1)]
    result = verify(signals, [judged("waste_dump", "roadside", 0.6)], ASKS_THE_JUDGE)

    assert result.outcome.decision == "rejected"
    veto = result.outcome.veto
    assert veto is not None and veto.reason == "detectors_veto:no_waste"
    assert [s.name for s in veto.sources] == ["yolo", "embedding_classifier", "vision_judge"]


def test_every_detector_no_but_a_sure_judge_keeps_the_combiner_decision() -> None:
    signals: list[Signal] = [FakeSignal("yolo", 0.0), FakeSignal("embedding_classifier", 0.1)]
    result = verify(signals, [judged("waste_dump", "roadside", 0.95)], ASKS_THE_JUDGE)

    assert result.outcome.veto is None


def test_every_detector_no_and_no_judge_answer_is_rejected() -> None:
    signals: list[Signal] = [FakeSignal("yolo", 0.1), FakeSignal("embedding_classifier", 0.15)]
    result = verify(signals, [provider_error()], ASKS_THE_JUDGE)

    assert result.judge is None
    assert result.outcome.decision == "rejected"
    veto = result.outcome.veto
    assert veto is not None and all(s.name != "vision_judge" for s in veto.sources)


def test_a_detector_that_sees_waste_blocks_the_detector_veto() -> None:
    signals: list[Signal] = [FakeSignal("yolo", 0.0), FakeSignal("embedding_classifier", 0.4)]
    result = verify(signals, [judged("waste_dump", "roadside", 0.6)], ASKS_THE_JUDGE)

    assert result.outcome.veto is None


def test_cleanup_judged_not_waste_is_still_clean() -> None:
    fits = '"confidence": 0.9, "scene_fits_site": true}'
    clean = INDOOR_ROOM.replace('"confidence": 0.95}', fits)
    provider = FakeProvider(NOVA_LITE, [clean])
    factory = ProviderFactory({"bedrock": FakeBuilder({NOVA_LITE: provider})})
    router = ProviderRouter({"judge": TaskConfig("bedrock", NOVA_LITE)}, factory, PriceTable())
    signals: list[Signal] = [FakeSignal("rekognition_labels", 1.0)]
    stacked = StackedVerifier(
        signals, VisionJudge(router, "p"), FixedWeightCombiner(Thresholds()), FixedClock()
    )
    result = stacked.verify(make_case("cleanup"))

    assert (result.outcome.decision, result.outcome.veto) == ("auto_verified", None)


def test_neutral_detectors_carry_no_vote() -> None:
    neutral = SignalResult("yolo", 0.0, "junksnap", "yolo26", "v1", 5, neutral=True)
    evidence = VetoEvidence((neutral,), None, Thresholds())

    assert DetectorsDenyJudgeUnsure().check(evidence) is None
