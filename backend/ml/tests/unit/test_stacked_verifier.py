from fakes import (
    FIXED_NOW,
    JUDGE_JSON,
    FakeBuilder,
    FakeProvider,
    FakeSignal,
    FixedClock,
    make_case,
    provider_error,
)

from ml.domain.llm import TaskConfig
from ml.domain.pricing import PriceTable
from ml.domain.verification import Thresholds
from ml.ports.signal import Signal
from ml.services.combiner import FixedWeightCombiner
from ml.services.provider_factory import ProviderFactory
from ml.services.provider_router import ProviderRouter
from ml.services.stacked_verifier import StackedVerifier
from ml.services.vision_judge import VisionJudge


def verifier(signals: list[Signal], judge_script: list[str | Exception]) -> tuple[
    StackedVerifier, FakeProvider
]:
    provider = FakeProvider("global.anthropic.claude-sonnet-4-6", judge_script)
    factory = ProviderFactory({"bedrock": FakeBuilder({provider.name: provider})})
    tasks = {"judge": TaskConfig("bedrock", provider.name)}
    judge = VisionJudge(ProviderRouter(tasks, factory, PriceTable()), "system prompt")
    combiner = FixedWeightCombiner(Thresholds())
    return StackedVerifier(signals, judge, combiner, FixedClock()), provider


def test_confident_signals_skip_the_judge() -> None:
    stacked, provider = verifier([FakeSignal("rekognition_labels", 0.95)], [JUDGE_JSON])

    result = stacked.verify(make_case())

    assert provider.requests == []
    assert result.judge is None
    assert [s.name for s in result.signals] == ["rekognition_labels"]
    assert result.outcome.decision == "auto_verified"
    assert result.decided_at == FIXED_NOW


def test_confident_rejection_skips_the_judge() -> None:
    stacked, provider = verifier([FakeSignal("rekognition_labels", 0.1)], [JUDGE_JSON])

    assert stacked.verify(make_case()).outcome.decision == "rejected"
    assert provider.requests == []


def test_unsure_signals_ask_the_judge_with_the_blurred_photo() -> None:
    stacked, provider = verifier([FakeSignal("rekognition_labels", 0.7)], [JUDGE_JSON])

    result = stacked.verify(make_case())

    assert provider.requests[0].images[0].source.startswith("media/")
    assert result.judge is not None
    assert result.judge.report_type == "waste_dump"
    judge_signal = result.signals[-1]
    assert (judge_signal.name, judge_signal.score) == ("vision_judge", 0.9)
    assert result.outcome.probability == (0.4 * 0.7 + 0.6 * 0.9) / 1.0


def test_disagreeing_signals_ask_the_judge() -> None:
    signals: list[Signal] = [FakeSignal("rekognition_labels", 0.95), FakeSignal("yolo", 0.2)]
    stacked, provider = verifier(signals, [JUDGE_JSON])

    result = stacked.verify(make_case())

    assert len(provider.requests) == 1
    assert result.outcome.disagreement is True
    assert result.outcome.decision == "community_check"


def test_judge_failure_keeps_the_signal_decision() -> None:
    stacked, _ = verifier([FakeSignal("rekognition_labels", 0.7)], [provider_error()])

    result = stacked.verify(make_case())

    assert result.judge is None
    assert result.outcome.decision == "community_check"


CLEAN_JSON = (
    JUDGE_JSON.replace('"waste_dump"', '"not_waste"').replace('"vacant_plot"', "null")
    .replace('"confidence": 0.9}', '"confidence": 0.9, "scene_fits_site": true}')
)


def test_cleanup_always_asks_the_judge_about_the_site() -> None:
    stacked, provider = verifier([FakeSignal("rekognition_labels", 1.0)], [CLEAN_JSON])

    result = stacked.verify(make_case("cleanup"))

    assert "after-cleanup photo of a site reported as waste_dump" in provider.requests[0].prompt
    assert result.judge is not None and result.judge.context is None
    assert (result.outcome.is_clean, result.outcome.decision) == (True, "auto_verified")


def test_cleanup_of_a_scene_that_does_not_fit_the_site_is_rejected() -> None:
    elsewhere = CLEAN_JSON.replace('"scene_fits_site": true', '"scene_fits_site": false')
    stacked, _ = verifier([FakeSignal("rekognition_labels", 1.0)], [elsewhere])

    result = stacked.verify(make_case("cleanup"))

    assert (result.outcome.is_clean, result.outcome.decision) == (False, "rejected")


def test_cleanup_without_a_judge_answer_is_rejected() -> None:
    stacked, _ = verifier([FakeSignal("rekognition_labels", 1.0)], [provider_error()])

    result = stacked.verify(make_case("cleanup"))

    assert result.judge is None
    assert (result.outcome.is_clean, result.outcome.decision) == (False, "rejected")


def test_report_prompt_says_nothing_about_the_claim() -> None:
    stacked, provider = verifier([FakeSignal("rekognition_labels", 0.7)], [JUDGE_JSON])

    stacked.verify(make_case())

    assert "waste_dump" not in provider.requests[0].prompt
