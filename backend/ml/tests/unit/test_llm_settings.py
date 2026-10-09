import pytest

from ml.domain.errors import ConfigError
from ml.domain.llm import ModelChoice
from ml.settings.llm import LlmSettings

LLM_VARIABLES = ("OPENAI_SECRET_ID", "LLM_TASKS")


@pytest.fixture(autouse=True)
def clean_llm_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in LLM_VARIABLES:
        monkeypatch.delenv(name, raising=False)


def test_judge_order_is_bedrock_then_openai() -> None:
    judge = LlmSettings.load().task_configs()["judge"]

    assert [choice.label() for choice in judge.choices()] == [
        "bedrock:global.anthropic.claude-sonnet-4-6",
        "bedrock:in.anthropic.claude-haiku-4-5-20251001-v1:0",
        "bedrock:apac.amazon.nova-pro-v1:0",
        "openai:gpt-4.1-mini",
    ]


def test_llm_tasks_replaces_the_judge_order(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "LLM_TASKS",
        '{"judge": {"provider": "bedrock", "model": "apac.amazon.nova-pro-v1:0",'
        ' "fallback": [{"provider": "openai", "model": "gpt-4.1-mini"}]}}',
    )

    judge = LlmSettings.load().task_configs()["judge"]

    assert judge.model == "apac.amazon.nova-pro-v1:0"
    assert judge.fallback == (ModelChoice("openai", "gpt-4.1-mini"),)


def test_unknown_provider_is_a_config_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_TASKS", '{"judge": {"provider": "openrouter", "model": "x"}}')

    with pytest.raises(ConfigError):
        LlmSettings.load()


def test_openai_secret_defaults_to_the_stage(monkeypatch: pytest.MonkeyPatch) -> None:
    assert LlmSettings.load().openai_secret("demo") == "junksnap/demo/openai-api-key"

    monkeypatch.setenv("OPENAI_SECRET_ID", "junksnap/dev/other")
    assert LlmSettings.load().openai_secret("dev") == "junksnap/dev/other"
