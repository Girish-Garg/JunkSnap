import pytest
from agent.domain.errors import ConfigError
from agent.domain.llm import ModelChoice
from agent.settings.llm import LlmSettings

LLM_VARIABLES = ("OPENAI_SECRET_ID", "OPENROUTER_SECRET_ID", "LLM_TASKS")


@pytest.fixture(autouse=True)
def clean_llm_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in LLM_VARIABLES:
        monkeypatch.delenv(name, raising=False)


def test_default_order_follows_decision_0133() -> None:
    judge = LlmSettings.load().task_configs()["judge"]

    assert [choice.label() for choice in judge.choices()] == [
        "bedrock:global.anthropic.claude-sonnet-4-6",
        "bedrock:in.anthropic.claude-haiku-4-5-20251001-v1:0",
        "bedrock:apac.amazon.nova-pro-v1:0",
        "openai:gpt-4.1-mini",
        "openrouter:google/gemini-2.5-flash",
    ]


def test_every_task_has_a_config() -> None:
    assert set(LlmSettings.load().task_configs()) == {"judge", "brands", "letters", "crawler"}


def test_llm_tasks_replaces_one_task(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "LLM_TASKS",
        '{"crawler": {"provider": "bedrock", "model": "apac.amazon.nova-lite-v1:0",'
        ' "fallback": [{"provider": "openai", "model": "gpt-4.1-mini"}]}}',
    )

    configs = LlmSettings.load().task_configs()

    assert configs["crawler"].model == "apac.amazon.nova-lite-v1:0"
    assert configs["crawler"].fallback == (ModelChoice("openai", "gpt-4.1-mini"),)
    assert configs["judge"].model == "global.anthropic.claude-sonnet-4-6"


def test_unknown_provider_is_a_config_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_TASKS", '{"judge": {"provider": "gemini", "model": "x"}}')

    with pytest.raises(ConfigError):
        LlmSettings.load()


def test_secret_ids_default_to_the_stage(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = LlmSettings.load()
    assert settings.openai_secret("demo") == "junksnap/demo/openai-api-key"
    assert settings.openrouter_secret("dev") == "junksnap/dev/openrouter-api-key"

    monkeypatch.setenv("OPENAI_SECRET_ID", "junksnap/dev/other")
    assert LlmSettings.load().openai_secret("dev") == "junksnap/dev/other"
