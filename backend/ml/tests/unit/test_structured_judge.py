"""Decision 20261011-0305: the judge's structured answer, its parsing and its claim mapping."""

import json
from importlib import resources

import pytest
from fakes import CLEAN_FIELDS, JUDGE_FIELDS, judge_json, make_case, scripted_judge
from pydantic import ValidationError

from ml.domain.auto_claims import claim_for
from ml.domain.judge_attributes import ClaimAnswer, TriState
from ml.domain.purposes import Purpose
from ml.domain.verification import Claim, JudgeVerdict
from ml.services.judge_answer import RATIONALE_MAX, JudgeAnswer

REPORT = Purpose.named("report")
ATTRIBUTES = (
    "garbage", "bin", "bin_overflowing_or_broken", "water_contamination", "construction_debris",
    "burning", "photo_usable", "user_verdict",
)


def parsed(reply: str) -> JudgeVerdict:
    return JudgeAnswer.model_validate_json(reply).to_verdict()


def shows(**fields: str) -> JudgeVerdict:
    """A usable photo with nothing in it but these attributes, the claim backed."""
    return parsed(judge_json(CLEAN_FIELDS, user_verdict="yes", **fields))


# Parsing and validation


def test_a_full_answer_reaches_the_verdict_and_the_old_fields_are_derived() -> None:
    verdict = parsed(judge_json(readable_brands=[" SAMPLE NAMKEEN ", " "]))

    assert verdict.attributes.to_contract() == {
        "garbage": "yes", "bin_overflowing_or_broken": "no", "water_contamination": "no",
        "construction_debris": "no", "bin": "no", "burning": "no", "photo_usable": "yes",
        "user_verdict": "yes", "user_verdict_confidence": 0.9, "prompt": "judge_v1",
    }
    assert (verdict.report_type, verdict.context, verdict.burning) == (
        "waste_dump", "vacant_plot", False,
    )
    assert (verdict.confidence, verdict.unclear) == (0.9, False)
    assert verdict.readable_brands == ("SAMPLE NAMKEEN",)
    assert verdict.rationale == "Mixed waste on an open plot."


@pytest.mark.parametrize("missing", ATTRIBUTES)
def test_a_missing_attribute_is_uncertain(missing: str) -> None:
    verdict = parsed(judge_json(**{missing: ...}))

    assert verdict.attributes.state(missing) is TriState.UNCERTAIN


@pytest.mark.parametrize(
    ("given", "state"),
    [
        ("yes", "yes"), ("No", "no"), (" YES ", "yes"), (True, "yes"), (False, "no"),
        ("maybe", "uncertain"), ("unclear", "uncertain"), (None, "uncertain"), (3, "uncertain"),
        ([], "uncertain"), ("uncertain", "uncertain"),
    ],
)
def test_attribute_values_are_read_safely(given: object, state: str) -> None:
    verdict = parsed(judge_json(user_verdict=given, garbage=given))

    assert verdict.attributes.user_verdict == state
    assert verdict.attributes.garbage == state


@pytest.mark.parametrize(
    ("given", "confidence"),
    [(0.7, 0.7), ("0.7", 0.7), (1.7, 1.0), (-1, 0.0), ("high", 0.5), (None, 0.5), (..., 0.5)],
)
def test_the_user_verdict_confidence_is_clamped_or_unsure(given: object, confidence: float) -> None:
    verdict = parsed(judge_json(user_verdict_confidence=given))

    assert verdict.attributes.user_verdict_confidence == pytest.approx(confidence)


def test_a_nan_confidence_is_unsure() -> None:
    reply = judge_json().replace('"user_verdict_confidence": 0.9', '"user_verdict_confidence": NaN')

    assert parsed(reply).attributes.user_verdict_confidence == 0.5


@pytest.mark.parametrize("context", ["pothole", 7, None, ...])
def test_an_unknown_or_missing_context_is_null(context: object) -> None:
    assert parsed(judge_json(context=context)).context is None


def test_the_reasoning_is_one_short_plain_line() -> None:
    long = "Waste\x00 on\n\n a  plot.\t" + "x" * 900
    verdict = parsed(judge_json(reasoning=long))

    assert verdict.rationale.startswith("Waste on a plot. x")
    assert len(verdict.rationale) == RATIONALE_MAX


def test_the_old_rationale_name_is_still_read() -> None:
    reply = judge_json(reasoning=..., rationale="Bags by the road.")

    assert parsed(reply).rationale == "Bags by the road."


@pytest.mark.parametrize(
    "reply",
    [
        '{"report_type": "waste_dump", "confidence": 0.9, "burning": false}',  # judge_v0
        "{}",
        "[]",
        '"yes"',
        json.dumps({"reasoning": "nothing judged"}),
    ],
)
def test_an_answer_that_judges_nothing_is_invalid(reply: str) -> None:
    with pytest.raises(ValidationError):
        JudgeAnswer.model_validate_json(reply)


def test_an_answer_that_judges_nothing_moves_to_the_next_try() -> None:
    old = '{"report_type": "waste_dump", "context": "roadside", "confidence": 0.9}'
    judge, provider = scripted_judge(old, judge_json())

    reading = judge.judge(make_case(claim=Claim("waste_dump", "roadside")))

    assert len(provider.requests) == 2
    assert reading is not None
    assert reading.verdict.answer_for(Claim("waste_dump", "roadside")) is ClaimAnswer.YES


def test_an_answer_with_only_a_user_verdict_is_uncertain_about_the_rest() -> None:
    verdict = parsed('{"user_verdict": "yes"}')

    assert verdict.attributes.garbage is TriState.UNCERTAIN
    assert verdict.answer_for(Claim("waste_dump", "roadside")) is ClaimAnswer.UNCERTAIN
    assert verdict.report_type == "not_waste"


# Claim types and the attributes they need


@pytest.mark.parametrize(
    ("claim", "fields", "answer"),
    [
        (Claim("waste_dump", "roadside"), {"garbage": "yes"}, ClaimAnswer.YES),
        (Claim("waste_dump", "roadside"), {"garbage": "uncertain"}, ClaimAnswer.UNCERTAIN),
        (Claim("waste_dump", "roadside"), {}, ClaimAnswer.NO),
        (Claim("overflowing_bin", "damaged"),
         {"bin": "yes", "bin_overflowing_or_broken": "yes"}, ClaimAnswer.YES),
        (Claim("overflowing_bin", "damaged"), {"bin": "yes"}, ClaimAnswer.NO),
        (Claim("overflowing_bin", "damaged"), {"garbage": "yes"}, ClaimAnswer.NO),
        (Claim("overflowing_bin", "overflowing"),
         {"bin": "yes", "bin_overflowing_or_broken": "uncertain"}, ClaimAnswer.UNCERTAIN),
        (Claim("overflowing_bin", "overflowing"),
         {"bin": "uncertain", "bin_overflowing_or_broken": "yes"}, ClaimAnswer.UNCERTAIN),
        (Claim("contaminated_water", "sewage"), {"water_contamination": "yes"}, ClaimAnswer.YES),
        (Claim("contaminated_water", "sewage"), {"garbage": "yes"}, ClaimAnswer.NO),
        (Claim("open_construction", "dusty_site"), {"construction_debris": "yes"}, ClaimAnswer.YES),
        (Claim("open_construction", "dusty_site"),
         {"construction_debris": "uncertain"}, ClaimAnswer.UNCERTAIN),
        (Claim("no_bin", "no_pickup"), {}, ClaimAnswer.NOT_JUDGED),
        (Claim("no_bin", "no_bin"), {"garbage": "yes"}, ClaimAnswer.NOT_JUDGED),
        (claim_for("open_construction", "auto"), {"construction_debris": "yes"}, ClaimAnswer.YES),
        (claim_for("auto", "auto"), {"water_contamination": "yes"}, ClaimAnswer.YES),
        (claim_for("auto", "auto"), {}, ClaimAnswer.NO),
        (claim_for("auto", "auto"), {"construction_debris": "uncertain"}, ClaimAnswer.UNCERTAIN),
    ],
)
def test_every_claim_type_needs_its_own_attributes(
    claim: Claim, fields: dict[str, str], answer: ClaimAnswer,
) -> None:
    assert shows(**fields).answer_for(claim) is answer


@pytest.mark.parametrize(
    ("fields", "answer"),
    [
        ({"user_verdict": "no"}, ClaimAnswer.NO),
        ({"user_verdict": "uncertain"}, ClaimAnswer.UNCERTAIN),
        ({"photo_usable": "uncertain"}, ClaimAnswer.UNCERTAIN),
        ({"photo_usable": "no"}, ClaimAnswer.UNUSABLE),
        ({"photo_usable": "no", "user_verdict": "no"}, ClaimAnswer.UNUSABLE),
        ({"user_verdict": "uncertain", "garbage": "no"}, ClaimAnswer.NO),
        ({"user_verdict": "no", "photo_usable": "uncertain"}, ClaimAnswer.NO),
        ({}, ClaimAnswer.YES),
    ],
)
def test_a_no_wins_over_uncertain_and_only_a_usable_photo_can_be_yes(
    fields: dict[str, str], answer: ClaimAnswer,
) -> None:
    assert parsed(judge_json(**fields)).answer_for(Claim("waste_dump", "drain")) is answer


@pytest.mark.parametrize(
    ("fields", "support"),
    [
        ({}, 0.9),
        ({"user_verdict_confidence": 0.2}, 0.8),  # a yes weighs at least 0.5
        ({"user_verdict": "no"}, 0.1),
        ({"user_verdict": "no", "user_verdict_confidence": 0.2}, 0.2),  # a no at most 0.5
        ({"user_verdict": "uncertain"}, 0.5),
        ({"photo_usable": "no"}, 0.0),
    ],
)
def test_the_judge_support_follows_the_claim_answer(
    fields: dict[str, object], support: float,
) -> None:
    verdict = parsed(judge_json(**fields))

    assert REPORT.judge_support(verdict, Claim("waste_dump", "drain")) == pytest.approx(support)


def test_a_no_bin_claim_gets_neither_support_nor_denial() -> None:
    assert REPORT.judge_support(parsed(judge_json()), Claim("no_bin", "no_bin")) == 0.5


@pytest.mark.parametrize(
    ("fields", "report_type", "context"),
    [
        ({"bin": "yes", "bin_overflowing_or_broken": "yes", "context": "damaged"},
         "overflowing_bin", "damaged"),
        ({"bin": "yes", "bin_overflowing_or_broken": "yes", "context": "roadside"},
         "waste_dump", "roadside"),  # garbage is there too, and the context names its type
        ({"garbage": "no", "bin": "yes", "bin_overflowing_or_broken": "yes", "context": "roadside"},
         "overflowing_bin", None),
        ({"water_contamination": "yes", "context": "roadside"}, "waste_dump", "roadside"),
        ({"water_contamination": "yes", "context": "foam"}, "contaminated_water", "foam"),
        ({"garbage": "no", "construction_debris": "yes", "context": "dusty_site"},
         "open_construction", "dusty_site"),
        ({"garbage": "no", "context": "roadside"}, "not_waste", None),
    ],
)
def test_the_old_type_is_the_contexts_type_when_shown_else_the_first_shown(
    fields: dict[str, str], report_type: str, context: str | None,
) -> None:
    verdict = parsed(judge_json({**JUDGE_FIELDS, **fields}))

    assert (verdict.report_type, verdict.context) == (report_type, context)


def test_the_prompt_defines_every_attribute_with_the_humans_examples() -> None:
    prompt = resources.files("ml.prompts").joinpath("judge_v1.txt").read_text(encoding="utf-8")

    for name in (*ATTRIBUTES, "user_verdict_confidence", "reasoning", "context"):
        assert f'"{name}":' in prompt
    assert "A clean dustbin with no waste around it, claim waste_dump" in prompt
    assert '"garbage": "no", "bin": "yes"' in prompt and '"user_verdict": "no"' in prompt
    assert "A dark or night photo where you can still see the scene is usable" in prompt
    assert "Never describe, identify or name a person" in prompt
