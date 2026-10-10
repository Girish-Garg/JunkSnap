"""Decisions 20261011-0230 and -0305: a strong judge "no" or an unusable photo never reaches the
map unless a trained detector is sure, and an uncertain answer asks the reporter.

Field case: a blurred close-up of a person sent as waste_dump/roadside. YOLO under 0.2,
embeddings 0.2 to 0.77, the judge's support about 0.1 ("too blurry to identify any waste").
"""

import json
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
)
from jsonschema import Draft202012Validator
from model_fakes import meta_model, meta_v2

from ml.domain.case import VerificationResult
from ml.domain.llm import TaskConfig
from ml.domain.pricing import PriceTable
from ml.domain.verification import Claim, Thresholds
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
ROADSIDE = Claim("waste_dump", "roadside")
COMBINERS: list[Combiner] = [
    FixedWeightCombiner(Thresholds()),
    MetaLearnerCombiner(meta_model(), Thresholds()),
    JudgeDecidesCombiner(FixedWeightCombiner(Thresholds()), "tests ask the judge"),
]
TOO_BLURRY = "The photo is too blurry to identify any waste or context."


def no_waste(confidence: float = 0.9) -> str:
    return judge_json(CLEAN_FIELDS, user_verdict_confidence=confidence, reasoning=TOO_BLURRY)


def unusable(**fields: object) -> str:
    return judge_json(photo_usable="no", reasoning=TOO_BLURRY, **fields)


def field_signals(embedding: float) -> list[Signal]:
    return [
        FakeSignal("rekognition_labels", 0.35), FakeSignal("yolo", 0.05),
        FakeSignal("embedding_classifier", embedding),
    ]


def sure_detectors() -> list[Signal]:
    """garbage_img__77 in the #123 replay: every detector sure of a real overflowing bin."""
    return [
        FakeSignal("rekognition_labels", 1.0), FakeSignal("yolo", 0.87),
        FakeSignal("embedding_classifier", 1.0),
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
    """Either reading of the confidence stays a "no" (decision 0230)."""
    combiner = MetaLearnerCombiner(meta_v2(), Thresholds())
    result = verify(prod_record_signals(), no_waste(confidence), combiner)

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
    result = verify(prod_record_signals(), judge_json(), combiner)

    assert result.outcome.probability < 0.5
    assert (result.outcome.decision, result.outcome.veto) == ("community_check", None)


@pytest.mark.parametrize("combiner", COMBINERS)
@pytest.mark.parametrize("embedding", [0.2, 0.49, 0.5, 0.77, 0.95])
def test_field_case_judged_no_is_rejected_whatever_the_embedding_head_says(
    combiner: Combiner, embedding: float,
) -> None:
    """Only YOLO can lift a judge "no"; the embedding head gave 0.77 to non-waste on prod."""
    result = verify(field_signals(embedding), no_waste(), combiner)

    assert (result.outcome.decision, reason(result)) == ("rejected", "judge_veto:not_waste")
    Draft202012Validator(SCHEMA).validate(result.to_contract())


@pytest.mark.parametrize(
    "combiner", [*COMBINERS, MetaLearnerCombiner(meta_v2(), Thresholds())],
)
@pytest.mark.parametrize(
    ("labels", "embedding", "reply"),
    [
        # The prod indoor cupboard: YOLO 0, embedding head 0.77, the judge says not waste.
        (0.55, 0.77, judge_json(CLEAN_FIELDS, reasoning="An indoor cupboard, not waste.")),
        # The prod blurred selfie (rpt_01m4krvscbptqdsaq2q54v9g32): YOLO 0, head 0.1994.
        (0.0, 0.1994, no_waste(0.1)),
    ],
    ids=["indoor_cupboard", "blurred_selfie"],
)
def test_the_two_prod_cases_stay_rejected(
    combiner: Combiner, labels: float, embedding: float, reply: str,
) -> None:
    signals: list[Signal] = [
        FakeSignal("rekognition_labels", labels), FakeSignal("yolo", 0.0),
        FakeSignal("embedding_classifier", embedding),
    ]
    result = verify(signals, reply, combiner)

    assert (result.outcome.decision, reason(result)) == ("rejected", "judge_veto:not_waste")
    assert "detector_yes" not in str(result.to_contract()["combiner"])


@pytest.mark.parametrize("combiner", COMBINERS)
@pytest.mark.parametrize("yolo", [0.5, 0.87])
def test_a_judge_no_against_a_sure_yolo_goes_to_neighbours(
    combiner: Combiner, yolo: float,
) -> None:
    signals: list[Signal] = [
        FakeSignal("rekognition_labels", 0.35), FakeSignal("yolo", yolo),
        FakeSignal("embedding_classifier", 0.1),
    ]
    result = verify(signals, no_waste(), combiner)

    assert (result.outcome.decision, reason(result)) == ("community_check", "judge_no:detector_yes")
    veto = result.outcome.veto
    assert veto is not None and [s.name for s in veto.sources] == ["vision_judge", "yolo"]
    contract = result.to_contract()
    assert "+judge_no:detector_yes by bedrock/" in str(contract["combiner"])
    assert "junksnap/fake@1" in str(contract["combiner"])  # the sure detector's model too
    Draft202012Validator(SCHEMA).validate(contract)


@pytest.mark.parametrize("combiner", COMBINERS)
@pytest.mark.parametrize("labels", [0.5, 0.77, 0.95])
def test_rekognition_labels_alone_never_lift_a_judge_no(combiner: Combiner, labels: float) -> None:
    """Rekognition's generic labels often see waste in clean streets; only our trained models."""
    signals: list[Signal] = [
        FakeSignal("rekognition_labels", labels), FakeSignal("yolo", 0.0),
        FakeSignal("embedding_classifier", 0.3),
    ]
    result = verify(signals, no_waste(0.85), combiner)

    assert result.outcome.decision == "rejected"
    assert (reason(result) or "").startswith("judge_veto:")


@pytest.mark.parametrize("combiner", COMBINERS)
@pytest.mark.parametrize("confidence", [0.1, 0.4, 0.9])
def test_an_unusable_photo_is_rejected_for_a_retake(combiner: Combiner, confidence: float) -> None:
    reply = unusable(user_verdict_confidence=confidence)
    result = verify(field_signals(0.3), reply, combiner)

    assert result.signals[-1].score == 0.0
    assert (result.outcome.decision, reason(result)) == ("rejected", "judge_veto:unclear")
    contract = result.to_contract()
    assert f"+judge_veto:unclear by bedrock/{NOVA_LITE}@" in str(contract["combiner"])
    assert contract["judge"]["attributes"]["photo_usable"] == "no"  # type: ignore[index]
    Draft202012Validator(SCHEMA).validate(contract)


@pytest.mark.parametrize("combiner", COMBINERS)
def test_an_unusable_photo_every_detector_is_sure_of_goes_to_neighbours(combiner: Combiner) -> None:
    """The #123 replay rejected a real overflowing bin (garbage_img__77) for photo_unclear."""
    reply = unusable(bin="yes", bin_overflowing_or_broken="yes", context="overflowing")
    result = verify(sure_detectors(), reply, combiner)

    assert (result.outcome.decision, reason(result)) == (
        "community_check", "judge_unclear:detector_yes",
    )
    veto = result.outcome.veto
    assert veto is not None
    assert [s.name for s in veto.sources] == ["vision_judge", "yolo"]


def test_an_unusable_photo_only_the_embedding_head_is_sure_of_is_rejected() -> None:
    signals: list[Signal] = [
        FakeSignal("rekognition_labels", 0.9), FakeSignal("yolo", 0.2),
        FakeSignal("embedding_classifier", 0.97),
    ]
    result = verify(signals, unusable(), COMBINERS[0])

    assert (result.outcome.decision, reason(result)) == ("rejected", "judge_veto:unclear")


def test_an_unusable_answer_that_names_no_waste_still_says_unclear() -> None:
    result = verify(field_signals(0.3), judge_json(CLEAN_FIELDS, photo_usable="no"), COMBINERS[0])

    assert reason(result) == "judge_veto:unclear"


@pytest.mark.parametrize("combiner", COMBINERS)
@pytest.mark.parametrize(
    "reply",
    [
        judge_json(user_verdict="uncertain"),
        judge_json(garbage="uncertain"),
        judge_json(photo_usable="uncertain"),
        judge_json(CLEAN_FIELDS, garbage="uncertain", user_verdict="uncertain"),
    ],
)
def test_an_uncertain_answer_asks_the_reporter_whatever_the_detectors_say(
    combiner: Combiner, reply: str,
) -> None:
    for signals in (sure_detectors(), prod_record_signals()):
        result = verify(signals, reply, combiner)

        assert (result.outcome.decision, reason(result)) == (
            "needs_confirmation", "judge_unsure:ask_reporter",
        )
        contract = result.to_contract()
        assert "+judge_unsure:ask_reporter by bedrock/" in str(contract["combiner"])
        Draft202012Validator(SCHEMA).validate(contract)


@pytest.mark.parametrize("combiner", COMBINERS)
def test_a_judge_yes_with_sure_detectors_is_combined_as_before(combiner: Combiner) -> None:
    result = verify(sure_detectors(), judge_json(user_verdict_confidence=0.95), combiner)

    assert (result.outcome.decision, result.outcome.veto) == ("auto_verified", None)


def test_an_unusable_cleanup_never_shows_the_site_clean() -> None:
    reply = judge_json(CLEAN_FIELDS, photo_usable="no", user_verdict="yes", scene_fits_site=True)
    signals: list[Signal] = [FakeSignal("rekognition_labels", 1.0)]
    result = verify(signals, reply, COMBINERS[0], purpose="cleanup")

    assert result.signals[-1].score == 0.0
    assert (result.outcome.decision, result.outcome.is_clean, result.outcome.veto) == (
        "rejected", False, None,
    )


@pytest.mark.parametrize(
    "fields",
    [
        {"garbage": "uncertain"}, {"garbage": "yes"}, {"photo_usable": "uncertain"},
        {"user_verdict": "uncertain"}, {"user_verdict": "no"}, {"scene_fits_site": False},
    ],
)
def test_a_cleanup_needs_no_garbage_a_usable_photo_and_the_judges_yes(
    fields: dict[str, object],
) -> None:
    """Cleanups are never asked again: anything short of a clear clean photo is rejected."""
    clean = {**CLEAN_FIELDS, "user_verdict": "yes", "scene_fits_site": True}
    signals: list[Signal] = [FakeSignal("rekognition_labels", 1.0)]
    result = verify(signals, judge_json(clean, **fields), COMBINERS[0], purpose="cleanup")

    assert result.signals[-1].score == 0.0
    assert (result.outcome.decision, result.outcome.is_clean) == ("rejected", False)
