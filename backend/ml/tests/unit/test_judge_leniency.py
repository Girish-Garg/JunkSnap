"""One bad insight field never costs the judge's answer; a weak hazard never settles burning."""

import pytest
from fakes import FixedClock, judge_json, make_case, provider_error, scripted_judge
from model_fakes import FakeObjectDetector

from ml.domain.case import VerificationResult
from ml.domain.insights import HAZARD_MIN, HazardSighting, InsightSource
from ml.domain.judge_attributes import ClaimAnswer, TriState
from ml.domain.verification import Claim, Thresholds
from ml.services.combiner import FixedWeightCombiner
from ml.services.judge_answer import JudgeAnswer
from ml.services.stacked_verifier import StackedVerifier
from ml.services.yolo_signal import YoloSignal

JUDGE = InsightSource("vision_judge", "bedrock", "apac.amazon.nova-lite-v1:0", "v1:0")
CLAIM = Claim("waste_dump", "vacant_plot")


def answer(**fields: object) -> JudgeAnswer:
    return JudgeAnswer.model_validate_json(judge_json(**fields))


# One bad optional field


@pytest.mark.parametrize(
    "fields",
    [
        {"hazards": [{"hazard": "glitter", "confidence": 0.9}]},
        {"composition": [{"material": "wood", "share": 0.5}]},
        {"composition": [{"material": "plastic", "share": 60}]},
        {"size_class": "Large"},
        {"size_class": "none"},
        {"composition": None, "hazards": None, "readable_brands": None},
        {"readable_brands": [f"Brand {n}" for n in range(25)]},
        {"hazards": [{"hazard": "e_waste"}, "chemicals"], "composition": [{"share": 0.4}, 7]},
    ],
)
def test_a_bad_insight_field_keeps_the_answer_on_the_first_try(fields: dict[str, object]) -> None:
    judge, provider = scripted_judge(judge_json(**fields), judge_json())

    reading = judge.judge(make_case(claim=CLAIM))

    assert reading is not None and len(provider.requests) == 1
    assert reading.verdict.answer_for(CLAIM) is ClaimAnswer.YES


def test_unknown_items_are_dropped_and_known_ones_kept() -> None:
    insights = answer(
        composition=[{"material": "wood", "share": 0.3}, {"material": "Plastic", "share": 0.5}],
        hazards=[{"hazard": "glitter", "confidence": 0.9},
                 {"hazard": "Dead Animal", "confidence": 0.7}],
    ).to_insights(JUDGE)

    assert [(s.material, s.share) for s in insights.composition] == [("plastic", 0.5)]
    assert insights.hazards == (HazardSighting("dead_animal", 0.7, JUDGE),)


def test_smoke_is_read_as_burning_as_decision_0202_lists_it() -> None:
    parsed = answer(burning="uncertain", hazards=[{"hazard": "smoke", "confidence": 0.8}])

    assert parsed.to_insights(JUDGE).hazards == (HazardSighting("burning", 0.8, JUDGE),)
    assert parsed.to_verdict().burning is True


def test_shares_given_as_percentages_are_read_as_fractions() -> None:
    composition = [{"material": "plastic", "share": 60}, {"material": "organic", "share": 0.3}]

    insights = answer(composition=composition).to_insights(JUDGE)

    assert [(s.material, s.share) for s in insights.composition] == [
        ("plastic", pytest.approx(0.6)), ("organic", pytest.approx(0.3))
    ]


@pytest.mark.parametrize(
    ("given", "size"),
    [("Large", "large"), (" small ", "small"), ("none", None), ("huge", None), (3, None)],
)
def test_the_size_class_is_lower_cased_and_none_is_null(given: object, size: str | None) -> None:
    found = answer(size_class=given).to_insights(JUDGE).size_class

    assert (None if found is None else found.value) == size


def test_null_lists_are_empty_and_long_lists_are_cut() -> None:
    nulls = answer(composition=None, hazards=None, readable_brands=None)
    many = answer(readable_brands=[f" Brand {n} " for n in range(25)])

    assert (nulls.composition, nulls.hazards, nulls.readable_brands) == ((), (), ())
    assert many.to_verdict().readable_brands == tuple(f"Brand {n}" for n in range(20))


def test_the_claim_attributes_stay_strict() -> None:
    parsed = answer(garbage="probably", user_verdict="Yes!", size_class="Large")

    assert (parsed.garbage, parsed.user_verdict) == (TriState.UNCERTAIN, TriState.UNCERTAIN)


# A weak hazard never settles burning


@pytest.mark.parametrize(
    ("burning", "confidence", "settled"),
    [
        ("no", 0.02, "no"),  # the prod repro: a near-zero hazard against an explicit no
        ("uncertain", 0.3, "uncertain"),
        (..., 0.49, "uncertain"),
        ("yes", 0.02, "uncertain"),  # a yes needs a hazard that clears the floor
        ("yes", HAZARD_MIN, "yes"),
        ("no", 0.8, "yes"),  # a confident listed hazard still wins
    ],
)
def test_only_a_hazard_at_the_floor_settles_burning(
    burning: object, confidence: float, settled: str
) -> None:
    parsed = answer(burning=burning, hazards=[{"hazard": "burning", "confidence": confidence}])

    verdict = parsed.to_verdict()

    assert verdict.attributes.burning == settled
    assert verdict.burning is (settled == "yes")
    listed = [sighting.hazard for sighting in parsed.to_insights(JUDGE).hazards]
    assert listed == (["burning"] if confidence >= HAZARD_MIN else [])


def test_weak_judge_hazards_are_left_out_of_the_insights() -> None:
    parsed = answer(hazards=[{"hazard": "e_waste", "confidence": 0.3}])

    assert parsed.to_insights(JUDGE).hazards == ()


# An unsure judge keeps the detectors' burning


def verified(script: str | Exception) -> VerificationResult:
    judge, _ = scripted_judge(script)
    yolo = YoloSignal(FakeObjectDetector([("burning", 0.92, 0.1), ("waste_pile", 0.9, 0.2)]))
    verifier = StackedVerifier([yolo], judge, FixedWeightCombiner(Thresholds()), FixedClock())
    return verifier.verify(make_case(claim=CLAIM))


@pytest.mark.parametrize("burning", ["uncertain", ..., "yes"])
def test_an_unsure_judge_keeps_the_burning_yolo_saw(burning: object) -> None:
    result = verified(judge_json(burning=burning, hazards=[]))

    assert result.judge is not None and result.judge.attributes.burning == "uncertain"
    assert [(h.hazard, h.confidence, h.source.signal) for h in result.insights.hazards] == [
        ("burning", 0.92, "yolo")
    ]


def test_a_judge_no_still_replaces_the_burning_yolo_saw() -> None:
    assert verified(judge_json(burning="no", hazards=[])).insights.burning is False


def test_without_the_judge_yolo_burning_stays() -> None:
    assert verified(provider_error()).insights.burning is True
