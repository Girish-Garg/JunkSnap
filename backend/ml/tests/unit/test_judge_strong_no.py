"""Decision 20261011-0230: a strong judge "no" or an unusable photo never reaches the map.

Field case: a blurred close-up of a person sent as waste_dump/roadside. YOLO under 0.2,
embeddings 0.6 to 0.77, the judge's support about 0.1 ("too blurry to identify any waste").
"""

import json
from pathlib import Path

import pytest
from fakes import JUDGE_JSON, FakeBuilder, FakeProvider, FakeSignal, FixedClock, make_case
from jsonschema import Draft202012Validator
from model_fakes import meta_model, meta_v2

from ml.domain.case import VerificationResult
from ml.domain.llm import TaskConfig
from ml.domain.pricing import PriceTable
from ml.domain.verification import Claim, Thresholds
from ml.ports.signal import Signal
from ml.services.combiner import FixedWeightCombiner
from ml.services.combiner_base import Combiner
from ml.services.judge_answer import JudgeAnswer
from ml.services.judge_decides_combiner import JudgeDecidesCombiner
from ml.services.meta_combiner import MetaLearnerCombiner
from ml.services.provider_factory import ProviderFactory
from ml.services.provider_router import ProviderRouter
from ml.services.stacked_verifier import StackedVerifier
from ml.services.vision_judge import VisionJudge

NOVA_LITE = "apac.amazon.nova-lite-v1:0"
SCHEMAS = Path(__file__).resolve().parents[4] / "contracts" / "schemas"
SCHEMA = json.loads((SCHEMAS / "verification_result.schema.json").read_text("utf-8"))
ROADSIDE = Claim("waste_dump", "roadside")
COMBINERS: list[Combiner] = [
    FixedWeightCombiner(Thresholds()),
    MetaLearnerCombiner(meta_model(), Thresholds()),
    JudgeDecidesCombiner(FixedWeightCombiner(Thresholds()), "tests ask the judge"),
]
TOO_BLURRY = "The photo is too blurry to identify any waste or context."


def answer(
    report_type: str = "waste_dump", context: str | None = "roadside", confidence: float = 0.1,
    unclear: bool | None = None,
) -> str:
    body = json.loads(JUDGE_JSON)
    body.update(report_type=report_type, context=context, confidence=confidence)
    body["rationale"] = TOO_BLURRY
    if unclear is not None:
        body["photo_unclear"] = unclear
    return json.dumps(body)


def field_signals(embedding: float) -> list[Signal]:
    return [
        FakeSignal("rekognition_labels", 0.35), FakeSignal("yolo", 0.05),
        FakeSignal("embedding_classifier", embedding),
    ]


def verify(
    signals: list[Signal], reply: str, combiner: Combiner, purpose: str = "report",
) -> VerificationResult:
    provider = FakeProvider(NOVA_LITE, [reply])
    factory = ProviderFactory({"bedrock": FakeBuilder({NOVA_LITE: provider})})
    router = ProviderRouter({"judge": TaskConfig("bedrock", NOVA_LITE)}, factory, PriceTable())
    stacked = StackedVerifier(signals, VisionJudge(router, "prompt"), combiner, FixedClock())
    claim = ROADSIDE if purpose == "report" else None
    return stacked.verify(make_case(purpose, claim=claim))


def reason(result: VerificationResult) -> str | None:
    veto = result.outcome.veto
    return None if veto is None else veto.reason


def prod_record_signals() -> list[Signal]:
    """rpt_01m4krvscbptqdsaq2q54v9g32: Rekognition 0, YOLO 0, embedding head 0.1994."""
    return [
        FakeSignal("rekognition_labels", 0.0), FakeSignal("yolo", 0.0),
        FakeSignal("embedding_classifier", 0.1994),
    ]


@pytest.mark.parametrize("confidence", [0.1, 0.9])
def test_prod_record_not_waste_is_rejected_by_the_judge_veto(confidence: float) -> None:
    """Nova Lite said not_waste; at confidence 0.1 the old 1 - c made it a 0.9 "yes".

    meta-v2 then gave 0.0198 and disagreement (0.9 against 0) forced community_check.
    """
    combiner = MetaLearnerCombiner(meta_v2(), Thresholds())
    reply = answer("not_waste", None, confidence)
    result = verify(prod_record_signals(), reply, combiner)

    assert result.combiner.version == "meta-v2"
    assert result.signals[-1].score == pytest.approx(0.1)
    assert result.outcome.probability < 0.05
    assert (result.outcome.decision, reason(result)) == ("rejected", "judge_veto:not_waste")
    contract = result.to_contract()
    assert f"meta-v2+judge_veto:not_waste by bedrock/{NOVA_LITE}@" in str(contract["combiner"])
    Draft202012Validator(SCHEMA).validate(contract)


def test_a_judge_yes_against_blind_detectors_still_goes_to_community_check() -> None:
    """Decision 0005: the detectors can be blind, so a judge "yes" keeps disagreement's lift."""
    combiner = MetaLearnerCombiner(meta_v2(), Thresholds())
    result = verify(prod_record_signals(), answer(confidence=0.9), combiner)

    assert result.outcome.probability < 0.5
    assert (result.outcome.decision, result.outcome.veto) == ("community_check", None)


@pytest.mark.parametrize("combiner", COMBINERS)
@pytest.mark.parametrize("embedding", [0.6, 0.77])
def test_field_case_low_support_of_the_claimed_type_is_rejected(
    combiner: Combiner, embedding: float,
) -> None:
    result = verify(field_signals(embedding), answer(), combiner)

    assert result.signals[-1].score == pytest.approx(0.1)
    assert (result.outcome.decision, reason(result)) == ("rejected", "judge_veto:low_support")
    contract = result.to_contract()
    assert f"+judge_veto:low_support by bedrock/{NOVA_LITE}@" in str(contract["combiner"])
    Draft202012Validator(SCHEMA).validate(contract)


@pytest.mark.parametrize("combiner", COMBINERS)
@pytest.mark.parametrize("confidence", [0.1, 0.4, 0.9])
def test_field_case_judged_unclear_is_rejected_for_a_retake(
    combiner: Combiner, confidence: float,
) -> None:
    result = verify(field_signals(0.77), answer(confidence=confidence, unclear=True), combiner)

    assert result.signals[-1].score == 0.0
    assert (result.outcome.decision, reason(result)) == ("rejected", "judge_veto:unclear")
    contract = result.to_contract()
    assert f"+judge_veto:unclear by bedrock/{NOVA_LITE}@" in str(contract["combiner"])
    assert "photo_unclear" not in json.dumps(contract) and "unclear" not in str(contract["judge"])
    Draft202012Validator(SCHEMA).validate(contract)


def test_an_unclear_not_waste_answer_still_says_unclear() -> None:
    reply = answer("not_waste", None, 0.9, unclear=True)
    result = verify(field_signals(0.77), reply, COMBINERS[0])

    assert reason(result) == "judge_veto:unclear"


@pytest.mark.parametrize("combiner", COMBINERS)
def test_a_confident_not_waste_keeps_its_own_reason(combiner: Combiner) -> None:
    result = verify(field_signals(0.77), answer("not_waste", None, 0.9), combiner)

    assert (result.outcome.decision, reason(result)) == ("rejected", "judge_veto:not_waste")


@pytest.mark.parametrize(
    "reply",
    [
        answer("not_waste", None, 0.5),  # support 0.5
        answer("contaminated_water", "stagnant", 0.1),  # another waste type: 0.5
        answer("overflowing_bin", "overflowing", 0.9),
        answer("waste_dump", "roadside", 0.6, unclear=False),
    ],
)
def test_answers_that_are_not_a_strong_no_are_not_vetoed(reply: str) -> None:
    result = verify(field_signals(0.77), reply, COMBINERS[0])

    assert result.outcome.veto is None
    assert result.outcome.decision == "community_check"


@pytest.mark.parametrize("combiner", COMBINERS)
def test_a_weak_judge_no_is_not_lifted_to_community_check_by_one_detector(
    combiner: Combiner,
) -> None:
    result = verify(field_signals(0.77), answer(confidence=0.3), combiner)

    assert result.outcome.disagreement is True and result.outcome.probability < 0.5
    assert (result.outcome.decision, reason(result)) == ("rejected", "judge_veto:combined_no")


@pytest.mark.parametrize("combiner", COMBINERS)
@pytest.mark.parametrize("others", [0.2, 0.5, 0.77, 0.95])
@pytest.mark.parametrize(
    "reply",
    [
        answer("not_waste", None, 0.85),
        answer(confidence=0.0),
        answer(confidence=0.19),
        answer(confidence=0.6, unclear=True),
    ],
)
def test_a_detector_no_and_a_strong_judge_no_never_give_community_check(
    combiner: Combiner, others: float, reply: str,
) -> None:
    signals: list[Signal] = [
        FakeSignal("rekognition_labels", others), FakeSignal("yolo", 0.0),
        FakeSignal("embedding_classifier", others),
    ]
    result = verify(signals, reply, combiner)

    assert result.outcome.decision == "rejected"
    assert (reason(result) or "").startswith("judge_veto:")


def test_an_unclear_cleanup_never_shows_the_site_clean() -> None:
    reply = answer("not_waste", None, 0.9, unclear=True).replace("}", ', "scene_fits_site": true}')
    signals: list[Signal] = [FakeSignal("rekognition_labels", 1.0)]
    result = verify(signals, reply, COMBINERS[0], purpose="cleanup")

    assert result.signals[-1].score == 0.0
    assert (result.outcome.decision, result.outcome.is_clean, result.outcome.veto) == (
        "rejected", False, None,
    )


def test_photo_unclear_defaults_to_a_usable_photo() -> None:
    verdict = JudgeAnswer.model_validate_json(JUDGE_JSON).to_verdict()

    assert verdict.unclear is False
    assert "unclear" not in verdict.to_contract()


def test_photo_unclear_reaches_the_verdict() -> None:
    reply = answer(unclear=True)

    assert JudgeAnswer.model_validate_json(reply).to_verdict().unclear is True
