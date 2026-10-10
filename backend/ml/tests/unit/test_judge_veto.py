"""Issue 103: a strong "no" from the judge, or from every detector, rejects the report photo.

Since decision 20261011-0305 the judge answers per attribute; a "no" goes to neighbours
instead when YOLO, our trained object detector, is sure there is waste.
"""

import json
from dataclasses import replace
from pathlib import Path

import pytest
from fakes import (
    CLEAN_FIELDS,
    FakeBuilder,
    FakeProvider,
    FakeSignal,
    FixedClock,
    judge_json,
    make_case,
    provider_error,
)
from jsonschema import Draft202012Validator
from model_fakes import meta_model

from ml.domain.case import VerificationResult
from ml.domain.llm import TaskConfig
from ml.domain.pricing import PriceTable
from ml.domain.purposes import ReportPurpose
from ml.domain.verification import Claim, Outcome, SignalResult, Thresholds
from ml.domain.vetoes import DetectorsDenyJudgeUnsure, JudgeAndCombinerSayNo, VetoEvidence
from ml.ports.signal import Signal
from ml.services.combiner import FixedWeightCombiner
from ml.services.combiner_base import Combiner
from ml.services.judge_decides_combiner import JudgeDecidesCombiner
from ml.services.meta_combiner import MetaLearnerCombiner
from ml.services.provider_factory import ProviderFactory
from ml.services.provider_router import ProviderRouter
from ml.services.stacked_verifier import StackedVerifier
from ml.services.vision_judge import VisionJudge

NOVA_LITE = "apac.amazon.nova-lite-v1:0"
SCHEMAS = Path(__file__).resolve().parents[4] / "contracts" / "schemas"
SCHEMA = json.loads((SCHEMAS / "verification_result.schema.json").read_text("utf-8"))
# The judge always runs, as for an untrained type; default thresholds.
ASKS_THE_JUDGE = JudgeDecidesCombiner(FixedWeightCombiner(Thresholds()), "tests ask the judge")
# A low community bar turns weak scores into community_check when the judge cannot answer.
LOW_BAR = JudgeDecidesCombiner(FixedWeightCombiner(Thresholds(0.85, 0.1)), "low bar")
INDOOR_ROOM = judge_json(
    CLEAN_FIELDS, user_verdict_confidence=0.95,
    reasoning="The photo shows an indoor scene with furniture and household items, not waste.",
)
COMBINERS = [FixedWeightCombiner(Thresholds()), MetaLearnerCombiner(meta_model(), Thresholds())]


def backed(confidence: float, context: str = "roadside") -> str:
    """The judge backs a waste_dump claim with this confidence."""
    return judge_json(context=context, user_verdict_confidence=confidence)


def prod_signals() -> list[Signal]:
    """The signals stored for the indoor-room report: YOLO 0, embeddings 0.77, labels unsure."""
    return [
        FakeSignal("rekognition_labels", 0.55), FakeSignal("yolo", 0.0),
        FakeSignal("embedding_classifier", 0.77),
    ]


def unsure_detectors() -> list[Signal]:
    """The same photo with the trained detectors under 0.5 and the labels sure of waste."""
    return [
        FakeSignal("rekognition_labels", 0.95), FakeSignal("yolo", 0.0),
        FakeSignal("embedding_classifier", 0.3),
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


def reason(result: VerificationResult) -> str | None:
    return None if result.outcome.veto is None else result.outcome.veto.reason


@pytest.mark.parametrize("combiner", COMBINERS)
def test_indoor_room_judged_not_waste_is_rejected_when_no_trained_detector_is_sure(
    combiner: Combiner,
) -> None:
    result = verify(unsure_detectors(), [INDOOR_ROOM], combiner)

    assert result.signals[-1].score == pytest.approx(0.05)
    assert result.outcome.disagreement is True
    assert (result.outcome.decision, reason(result)) == ("rejected", "judge_veto:not_waste")
    contract = result.to_contract()
    assert f"+judge_veto:not_waste by bedrock/{NOVA_LITE}@4.6" in str(contract["combiner"])
    Draft202012Validator(SCHEMA).validate(contract)


@pytest.mark.parametrize("combiner", COMBINERS)
def test_the_prod_indoor_room_is_rejected_although_the_embedding_head_is_sure(
    combiner: Combiner,
) -> None:
    """Decision 0305: only YOLO lifts a judge "no"; the head's 0.77 here was wrong."""
    result = verify(prod_signals(), [INDOOR_ROOM], combiner)

    assert (result.outcome.decision, reason(result)) == ("rejected", "judge_veto:not_waste")
    Draft202012Validator(SCHEMA).validate(result.to_contract())


@pytest.mark.parametrize("combiner", COMBINERS)
def test_a_judge_no_goes_to_neighbours_when_yolo_is_sure(combiner: Combiner) -> None:
    signals: list[Signal] = [*prod_signals()[:1], FakeSignal("yolo", 0.8),
                             FakeSignal("embedding_classifier", 0.1)]
    result = verify(signals, [INDOOR_ROOM], combiner)

    assert (result.outcome.decision, reason(result)) == ("community_check", "judge_no:detector_yes")
    veto = result.outcome.veto
    assert veto is not None
    assert [s.name for s in veto.sources] == ["vision_judge", "yolo"]
    contract = result.to_contract()
    assert "+judge_no:detector_yes by bedrock/" in str(contract["combiner"])
    Draft202012Validator(SCHEMA).validate(contract)


def test_without_the_rules_the_same_photo_went_to_community_check() -> None:
    provider = FakeProvider(NOVA_LITE, [INDOOR_ROOM])
    factory = ProviderFactory({"bedrock": FakeBuilder({NOVA_LITE: provider})})
    router = ProviderRouter({"judge": TaskConfig("bedrock", NOVA_LITE)}, factory, PriceTable())
    stacked = StackedVerifier(
        unsure_detectors(), VisionJudge(router, "p"), FixedWeightCombiner(Thresholds()),
        FixedClock(),
    )
    case = replace(make_case(), purpose=ReportPurpose(vetoes=()))
    assert stacked.verify(case).outcome.decision == "community_check"


def test_waste_the_judge_says_is_not_the_claim_is_low_support() -> None:
    """Garbage is there, but the judge says the photo does not show the claim."""
    reply = judge_json(user_verdict="no", user_verdict_confidence=0.9)
    result = verify(unsure_detectors(), [reply])

    assert result.signals[-1].score == pytest.approx(0.1)
    assert (result.outcome.decision, reason(result)) == ("rejected", "judge_veto:low_support")


def test_a_weak_yes_against_strong_detectors_falls_through_to_the_combiner() -> None:
    signals: list[Signal] = [FakeSignal("yolo", 0.9), FakeSignal("embedding_classifier", 0.9)]
    result = verify(signals, [backed(0.3)])

    assert result.signals[-1].score == pytest.approx(0.7)  # a yes weighs at least 0.5
    assert result.outcome.veto is None
    assert result.outcome.decision == "community_check"


def test_an_uncertain_answer_against_strong_detectors_asks_the_reporter() -> None:
    signals: list[Signal] = [FakeSignal("yolo", 0.9), FakeSignal("embedding_classifier", 0.9)]
    unsure = judge_json(garbage="uncertain", user_verdict="uncertain", user_verdict_confidence=0.5)
    result = verify(signals, [unsure], ASKS_THE_JUDGE)

    assert result.signals[-1].score == pytest.approx(0.5)
    assert (result.outcome.decision, reason(result)) == (
        "needs_confirmation", "judge_unsure:ask_reporter",
    )


@pytest.mark.parametrize(
    ("claim", "answer"),
    [
        (
            Claim("overflowing_bin", "overflowing"),
            judge_json(bin="yes", bin_overflowing_or_broken="yes", context="overflowing"),
        ),
        (Claim("waste_dump", "drain"), backed(0.6, "drain")),
        (Claim("no_bin", "no_pickup"), INDOOR_ROOM),  # no_bin is never judged from a photo
    ],
)
def test_judge_backing_the_claim_or_a_claim_never_judged_never_vetoes(
    claim: Claim, answer: str,
) -> None:
    result = verify(prod_signals(), [answer], claim=claim)

    assert result.outcome.veto is None
    assert result.outcome.decision == "community_check"


def test_loose_waste_without_a_bin_denies_an_overflowing_bin_claim() -> None:
    result = verify(unsure_detectors(), [backed(0.9)], claim=Claim("overflowing_bin", "damaged"))

    assert (result.outcome.decision, reason(result)) == ("rejected", "judge_veto:low_support")


def test_a_clean_photo_denies_an_overflowing_bin_claim() -> None:
    reply = judge_json(CLEAN_FIELDS, bin="yes")  # a clean bin
    result = verify(unsure_detectors(), [reply], claim=Claim("overflowing_bin", "damaged"))

    assert (result.outcome.decision, reason(result)) == ("rejected", "judge_veto:not_waste")


def test_every_detector_no_and_a_strong_judge_no_is_the_judges_veto() -> None:
    signals: list[Signal] = [FakeSignal("yolo", 0.0), FakeSignal("embedding_classifier", 0.1)]
    result = verify(signals, [INDOOR_ROOM], ASKS_THE_JUDGE)

    assert (result.outcome.decision, reason(result)) == ("rejected", "judge_veto:not_waste")


@pytest.mark.parametrize("confidence", [0.5, 0.6, 0.84])
def test_every_detector_no_and_a_judge_yes_goes_to_community_check(confidence: float) -> None:
    signals: list[Signal] = [FakeSignal("yolo", 0.0), FakeSignal("embedding_classifier", 0.1)]
    result = verify(signals, [backed(confidence)], ASKS_THE_JUDGE)

    assert result.signals[-1].score == pytest.approx(confidence)
    assert result.outcome.veto is None
    assert result.outcome.decision == "community_check"


def test_every_detector_no_but_a_sure_judge_keeps_the_combiner_decision() -> None:
    signals: list[Signal] = [FakeSignal("yolo", 0.0), FakeSignal("embedding_classifier", 0.1)]
    result = verify(signals, [backed(0.95)], ASKS_THE_JUDGE)

    assert result.outcome.veto is None


def test_every_detector_no_and_no_judge_answer_is_rejected() -> None:
    signals: list[Signal] = [FakeSignal("yolo", 0.1), FakeSignal("embedding_classifier", 0.15)]
    result = verify(signals, [provider_error()], LOW_BAR)

    assert result.judge is None
    assert result.outcome.decision == "rejected"
    veto = result.outcome.veto
    assert veto is not None and veto.reason == "detectors_veto:no_waste"
    assert all(s.name != "vision_judge" for s in veto.sources)


def test_a_detector_that_sees_waste_blocks_the_detector_veto() -> None:
    signals: list[Signal] = [FakeSignal("yolo", 0.0), FakeSignal("embedding_classifier", 0.4)]
    result = verify(signals, [provider_error()], LOW_BAR)

    assert result.outcome.veto is None


def test_cleanup_judged_clean_is_still_clean() -> None:
    clean = judge_json(CLEAN_FIELDS, user_verdict="yes", scene_fits_site=True)
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


@pytest.mark.parametrize(("probability", "judge", "fires"), [
    (0.3, 0.3, True), (0.5, 0.3, False), (0.3, 0.5, False),
])
def test_disagreement_never_lifts_a_low_judge_and_a_low_probability(
    probability: float, judge: float, fires: bool,
) -> None:
    """The last guard (decision 0230) for a judge support no structured rule settled."""
    signals = (
        SignalResult("embedding_classifier", 0.9, "junksnap", "clf", "1", 5),
        SignalResult("vision_judge", judge, "bedrock", NOVA_LITE, "v1:0", 5),
    )
    outcome = Outcome(probability, "community_check", True, None)
    veto = JudgeAndCombinerSayNo().check(VetoEvidence(signals, None, Thresholds(), outcome))

    assert (veto is not None) is fires
    assert veto is None or veto.reason == "judge_veto:combined_no"
