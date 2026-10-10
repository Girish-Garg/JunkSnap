"""Auto claims (contracts v1.10): area scout frames and frames whose place the judge names."""

from typing import Any

import pytest
from fakes import (
    JUDGE_JSON,
    FakeBuilder,
    FakeDetector,
    FakeProvider,
    FakeSignal,
    FixedClock,
    make_case,
)
from model_fakes import meta_model

from ml.domain.auto_claims import AutoContextClaim, ScoutClaim, claim_for
from ml.domain.errors import InvalidClaimError
from ml.domain.label_insights import LabelInsights
from ml.domain.llm import TaskConfig
from ml.domain.pricing import PriceTable
from ml.domain.purposes import Purpose
from ml.domain.verification import Claim, JudgeVerdict, Thresholds
from ml.handlers.verify_body import VerifyBody
from ml.services.combiner import FixedWeightCombiner
from ml.services.combiner_base import Combiner
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


def answer(report_type: str, context: str | None, confidence: float = 0.9) -> str:
    named = "null" if context is None else f'"{context}"'
    return (
        JUDGE_JSON.replace('"waste_dump"', f'"{report_type}"')
        .replace('"vacant_plot"', named)
        .replace('"confidence": 0.9', f'"confidence": {confidence}')
    )


def verdict(report_type: str, confidence: float = 0.9) -> JudgeVerdict:
    return JudgeVerdict(report_type, None, False, (), "sample", confidence)


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


def test_a_scout_claim_is_backed_by_any_waste_it_can_find_and_denied_by_no_bin() -> None:
    report = Purpose.named("report")
    assert report.judge_support(verdict("overflowing_bin"), SCOUT) == pytest.approx(0.9)
    assert report.judge_support(verdict("contaminated_water"), SCOUT) == pytest.approx(0.9)
    assert report.judge_support(verdict("not_waste"), SCOUT) == pytest.approx(0.1)
    assert report.judge_support(verdict("no_bin"), SCOUT) == pytest.approx(0.1)
    picked = claim_for("waste_dump", "auto")
    assert report.judge_support(verdict("waste_dump"), picked) == pytest.approx(0.9)
    assert report.judge_support(verdict("overflowing_bin"), picked) == pytest.approx(0.5)


def test_every_combiner_asks_for_the_judge_on_an_auto_claim() -> None:
    combiners: list[Combiner] = [
        FixedWeightCombiner(Thresholds()), MetaLearnerCombiner(meta_model(), Thresholds())
    ]
    for combiner in combiners:
        for claim in (SCOUT, claim_for("waste_dump", "auto")):
            chosen = combiner.for_claim(claim)
            assert chosen.needs_judge([FakeSignal("yolo", 0.99)], Purpose.named("report"))
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
    assert result.to_contract()["judge"] == {
        "report_type": "not_waste", "context": None, "burning": False,
        "readable_brands": [], "rationale": "Mixed waste on an open plot.",
    }


def test_the_judge_veto_rejects_a_scout_frame_even_against_sure_detectors() -> None:
    """A no_bin answer is not vetoed here; the worker rejects it as nothing a scout can find."""
    verifier, _provider = stacked_scout(answer("not_waste", None, 0.95), 0.95)
    result = verifier.verify(make_case(claim=SCOUT))
    assert result.outcome.disagreement
    assert result.outcome.decision == "rejected"
    assert result.outcome.veto is not None
    assert result.outcome.veto.reason.startswith("judge_veto")
