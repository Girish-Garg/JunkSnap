import logging

import httpx
import pytest
from fakes import JUDGE_JSON, FakeBuilder, FakeProvider, FakeSecrets, provider_error

from ml.adapters.openai_compatible import OpenAiProviderBuilder
from ml.domain.errors import ConfigError, NoProviderAnsweredError
from ml.domain.llm import LlmRequest, ModelChoice, TaskConfig
from ml.domain.pricing import PriceTable
from ml.ports.llm_provider import LlmProvider, ProviderBuilder
from ml.services.judge_answer import JudgeAnswer
from ml.services.provider_factory import ProviderFactory
from ml.services.provider_router import INVALID_JSON_REMINDER, JsonJob, ProviderRouter

TASK = TaskConfig("bedrock", "first", (ModelChoice("bedrock", "second"),))
JOB = JsonJob("judge", LlmRequest(system="judge", prompt="photo"), JudgeAnswer)


def router(providers: dict[str, LlmProvider | None], **builders: ProviderBuilder) -> ProviderRouter:
    factory = ProviderFactory({"bedrock": FakeBuilder(providers), **builders})
    return ProviderRouter({"judge": TASK}, factory, PriceTable())


def test_first_valid_answer_wins() -> None:
    first = FakeProvider("first", [JUDGE_JSON])

    answer = router({"first": first, "second": None}).complete_json(JOB)

    assert answer.value.to_verdict().report_type == "waste_dump"
    assert answer.response.model == "first"


def test_falls_back_on_provider_error() -> None:
    first = FakeProvider("first", [provider_error()])
    second = FakeProvider("second", [JUDGE_JSON])

    answer = router({"first": first, "second": second}).complete_json(JOB)

    assert answer.response.model == "second"
    assert len(first.requests) == 1


def test_retries_once_on_invalid_json_with_a_reminder() -> None:
    first = FakeProvider("first", ["not json", JUDGE_JSON])

    answer = router({"first": first, "second": None}).complete_json(JOB)

    assert answer.response.model == "first"
    assert INVALID_JSON_REMINDER in first.requests[1].prompt


def test_moves_on_after_two_invalid_answers() -> None:
    first = FakeProvider("first", ['{"report_type": "pothole"}', "```json\n{}\n```"])
    second = FakeProvider("second", [f"```json\n{JUDGE_JSON}\n```"])

    answer = router({"first": first, "second": second}).complete_json(JOB)

    assert answer.response.model == "second"
    assert len(first.requests) == 2


def test_skips_provider_without_key() -> None:
    task = TaskConfig("openai", "gpt-4.1-mini", (ModelChoice("bedrock", "second"),))
    openai = OpenAiProviderBuilder(httpx.Client(), FakeSecrets({}), "openai-key")
    second = FakeProvider("second", [JUDGE_JSON])
    factory = ProviderFactory({"bedrock": FakeBuilder({"second": second}), "openai": openai})

    answer = ProviderRouter({"judge": task}, factory, PriceTable()).complete_json(JOB)

    assert answer.response.model == "second"


def test_a_key_added_later_takes_effect_without_a_restart() -> None:
    secrets: dict[str, str] = {}
    openai = OpenAiProviderBuilder(httpx.Client(), FakeSecrets(secrets), "openai-key")
    factory = ProviderFactory({"openai": openai})
    choice = ModelChoice("openai", "gpt-4.1-mini")

    assert factory.build(choice) is None
    secrets["openai-key"] = "sk-added"

    assert factory.build(choice) is not None


def test_raises_when_every_provider_fails() -> None:
    first = FakeProvider("first", [provider_error()])

    with pytest.raises(NoProviderAnsweredError):
        router({"first": first, "second": None}).complete_json(JOB)


def test_unknown_task_is_a_config_error() -> None:
    with pytest.raises(ConfigError):
        router({}).complete_json(JsonJob("letters", JOB.request, JudgeAnswer))


def test_logs_provider_model_version_latency_and_cost(caplog: pytest.LogCaptureFixture) -> None:
    first = FakeProvider("global.anthropic.claude-sonnet-4-6", [JUDGE_JSON])
    task = TaskConfig("bedrock", "global.anthropic.claude-sonnet-4-6")
    factory = ProviderFactory({"bedrock": FakeBuilder({first.name: first})})
    caplog.set_level(logging.INFO)

    ProviderRouter({"judge": task}, factory, PriceTable()).complete_json(JOB)

    fields = next(r for r in caplog.records if r.getMessage() == "llm_call").__dict__["fields"]
    assert fields["provider"] == "bedrock"
    assert fields["model"] == "global.anthropic.claude-sonnet-4-6"
    assert fields["version"] == "4.6"
    assert fields["latency_ms"] == 1200
    assert fields["cost_usd_estimate"] == pytest.approx((1000 * 3.0 + 100 * 15.0) / 1_000_000)
