from agent.domain.llm import TaskConfig
from agent.domain.pricing import PriceTable
from agent.domain.verification import Thresholds
from agent.ports.signal import Signal
from agent.services.combiner import FixedWeightCombiner
from agent.services.provider_factory import ProviderFactory
from agent.services.provider_router import ProviderRouter
from agent.services.stacked_verifier import StackedVerifier
from agent.services.vision_judge import VisionJudge
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


def test_cleanup_judge_support_comes_from_not_waste() -> None:
    clean_json = JUDGE_JSON.replace('"waste_dump"', '"not_waste"').replace('"vacant_plot"', "null")
    stacked, _ = verifier([FakeSignal("rekognition_labels", 0.8)], [clean_json])

    result = stacked.verify(make_case("cleanup"))

    assert result.judge is not None and result.judge.context is None
    assert result.outcome.is_clean is True
    assert result.outcome.decision == "auto_verified"
