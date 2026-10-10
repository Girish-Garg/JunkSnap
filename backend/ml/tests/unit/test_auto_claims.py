"""Auto claims (contracts v1.10): area scout frames and frames whose place the judge names."""

from typing import Any

import pytest
from fakes import (
    CLEAN_FIELDS,
    JUDGE_FIELDS,
    FakeBuilder,
    FakeDetector,
    FakeProvider,
    FakeSignal,
    FixedClock,
    judge_json,
    make_case,
)
from model_fakes import meta_model

from ml.domain.auto_claims import AutoContextClaim, ScoutClaim, claim_for
from ml.domain.errors import InvalidClaimError
from ml.domain.judge_attributes import ClaimAnswer
from ml.domain.label_insights import LabelInsights
from ml.domain.llm import TaskConfig
from ml.domain.pricing import PriceTable
from ml.domain.purposes import Purpose
from ml.domain.verification import Claim, JudgeVerdict, SignalResult, Thresholds
from ml.handlers.verify_body import VerifyBody
from ml.services.combiner import FixedWeightCombiner
from ml.services.combiner_base import Combiner
from ml.services.judge_answer import JudgeAnswer
from ml.services.judge_decides_combiner import AUTO_CLAIM_REASON
from ml.services.label_signal import RekognitionLabelSignal
from ml.services.meta_combiner import MetaLearnerCombiner
from ml.services.provider_factory import ProviderFactory
from ml.services.provider_router import ProviderRouter
from ml.services.stacked_verifier import StackedVerifier
from ml.services.vision_judge import VisionJudge

SCOUT = ScoutClaim("auto", "auto")
FEATURES = {"gps_accuracy_m": 5, "reputation": 0.5, "nearby_verified_reports": 0}


def body(report_type: str, context: str, purpose: str = "report") -> dict[str, Any]:
    prefix = "rpt" if purpose == "report" else "cln"
    folder = "reports" if purpose == "report" else "cleanups"
    return {
        "report_id": f"{prefix}_1", "purpose": purpose,
        "blurred_key": f"media/{folder}/{prefix}_1.jpg",
        "report_type": report_type, "context": context, "features": FEATURES,
    }


# What the judge sees for each shown type, as judge_v1 attributes.
SHOWN: dict[str, dict[str, object]] = {
    "waste_dump": {},
    "overflowing_bin": {"bin": "yes", "bin_overflowing_or_broken": "yes"},
    "contaminated_water": {"garbage": "no", "water_contamination": "yes"},
    "not_waste": {**CLEAN_FIELDS, "user_verdict": "yes"},  # the user verdict is left to the rules
}


def answer(shown: str, context: str | None, confidence: float = 0.9, verdict: str = "yes") -> str:
    fields = {**JUDGE_FIELDS, **SHOWN[shown], "context": context}
    return judge_json(fields, user_verdict=verdict, user_verdict_confidence=confidence)


def verdict(shown: str, user_verdict: str = "yes") -> JudgeVerdict:
    reply = answer(shown, None, 0.9, user_verdict)
    return JudgeAnswer.model_validate_json(reply).to_verdict()


def test_the_verify_body_accepts_an_area_scout_and_an_automatic_place() -> None:
    scout = VerifyBody.model_validate(body("auto", "auto")).to_input().claim
    place = VerifyBody.model_validate(body("overflowing_bin", "auto")).to_input().claim
    plain = VerifyBody.model_validate(body("waste_dump", "drain")).to_input().claim
    assert isinstance(scout, ScoutClaim) and scout.judge_required
    assert isinstance(place, AutoContextClaim) and place.judge_required
    assert type(plain) is Claim and not plain.judge_required


@pytest.mark.parametrize(
    ("report_type", "context", "purpose"),
    [("auto", "vacant_plot", "report"), ("no_bin", "auto", "report"), ("auto", "auto", "cleanup")],
)
def test_auto_claims_outside_the_contract_pairs_are_refused(
    report_type: str, context: str, purpose: str
) -> None:
    with pytest.raises(InvalidClaimError):
        VerifyBody.model_validate(body(report_type, context, purpose)).to_input()


def test_a_scout_claim_is_backed_by_any_waste_it_can_find_and_denied_by_a_clean_photo() -> None:
    report = Purpose.named("report")
    assert report.judge_support(verdict("overflowing_bin"), SCOUT) == pytest.approx(0.9)
    assert report.judge_support(verdict("contaminated_water"), SCOUT) == pytest.approx(0.9)
    clean = verdict("not_waste")
    assert clean.answer_for(SCOUT) is ClaimAnswer.NO
    assert report.judge_support(clean, SCOUT) == pytest.approx(0.1)
    picked = claim_for("waste_dump", "auto")
    assert report.judge_support(verdict("waste_dump"), picked) == pytest.approx(0.9)
    water = claim_for("contaminated_water", "auto")
    assert verdict("waste_dump").answer_for(water) is ClaimAnswer.NO  # no dirty water seen
    assert report.judge_support(verdict("waste_dump"), water) == pytest.approx(0.1)


def test_a_scout_claim_with_nothing_shown_for_sure_is_uncertain() -> None:
    unsure = JudgeAnswer.model_validate_json(
        judge_json(CLEAN_FIELDS, garbage="uncertain", user_verdict="uncertain")
    ).to_verdict()

    assert unsure.answer_for(SCOUT) is ClaimAnswer.UNCERTAIN
    assert unsure.report_type == "not_waste"  # nothing shown for sure, so no type is named


def test_every_combiner_needs_the_judges_answer_on_an_auto_claim() -> None:
    combiners: list[Combiner] = [
        FixedWeightCombiner(Thresholds()), MetaLearnerCombiner(meta_model(), Thresholds())
    ]
    sure = [SignalResult("yolo", 0.99, "junksnap", "fake", "1", 10)]
    for combiner in combiners:
        for claim in (SCOUT, claim_for("waste_dump", "auto")):
            unjudged = combiner.for_claim(claim).combine(sure, Purpose.named("report"))
            assert unjudged.decision == "community_check"
    meta = MetaLearnerCombiner(meta_model(), Thresholds())
    assert meta.for_claim(claim_for("waste_dump", "auto")).info().reason == AUTO_CLAIM_REASON
    fixed = FixedWeightCombiner(Thresholds())
    assert fixed.for_claim(Claim("waste_dump", "drain")) is fixed


def test_rekognition_scores_a_scout_frame_with_any_waste_label() -> None:
    signal = RekognitionLabelSignal(FakeDetector({"Garbage": 0.8}), LabelInsights())
    assert signal.measure(make_case(claim=SCOUT)).score == pytest.approx(0.8)


def stacked_scout(reply: str, label_score: float) -> tuple[StackedVerifier, FakeProvider]:
    provider = FakeProvider("global.anthropic.claude-sonnet-4-6", [reply])
    factory = ProviderFactory({"bedrock": FakeBuilder({provider.name: provider})})
    router = ProviderRouter({"judge": TaskConfig("bedrock", provider.name)}, factory, PriceTable())
    signals = [FakeSignal("rekognition_labels", label_score)]
    combiner = FixedWeightCombiner(Thresholds())
    return StackedVerifier(signals, VisionJudge(router, "prompt"), combiner, FixedClock()), provider


def test_the_judge_names_a_scout_frame_even_when_the_detectors_are_sure() -> None:
    verifier, provider = stacked_scout(answer("overflowing_bin", "damaged"), 0.95)
    result = verifier.verify(make_case(claim=SCOUT))
    assert len(provider.requests) == 1
    assert result.judge is not None
    assert (result.judge.report_type, result.judge.context) == ("overflowing_bin", "damaged")
    assert result.outcome.decision == "auto_verified"
    judge = next(s for s in result.signals if s.name == "vision_judge")
    assert (judge.provider, judge.model, judge.version) == ("bedrock", provider.name, "4.6")


def test_a_scout_frame_the_judge_calls_not_waste_is_rejected() -> None:
    verifier, _provider = stacked_scout(answer("not_waste", None), 0.3)
    result = verifier.verify(make_case(claim=SCOUT))
    assert result.outcome.decision == "rejected"
    judge = result.to_contract()["judge"]
    assert isinstance(judge, dict)
    assert {key: value for key, value in judge.items() if key != "attributes"} == {
        "report_type": "not_waste", "context": None, "burning": False,
        "readable_brands": [], "rationale": "A clean street with no waste.",
    }
    assert judge["attributes"]["garbage"] == "no"


def test_the_judge_veto_rejects_a_scout_frame_even_against_sure_detectors() -> None:
    """Rekognition's labels are not a trained detector, so they never lift the judge's no."""
    verifier, _provider = stacked_scout(answer("not_waste", None, 0.95), 0.95)
    result = verifier.verify(make_case(claim=SCOUT))
    assert result.outcome.disagreement
    assert result.outcome.decision == "rejected"
    assert result.outcome.veto is not None
    assert result.outcome.veto.reason.startswith("judge_veto")
