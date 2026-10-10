"""Vision judge provider settings: OPENAI_SECRET_ID and LLM_TASKS."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from ml.domain.llm import ModelChoice, TaskConfig
from ml.settings.base import EnvSettings

TASKS = ("judge",)

# Decision 20261010-0133: Bedrock first, then OpenAI.
DEFAULT_TASK_CONFIG = TaskConfig(
    provider="bedrock",
    model="global.anthropic.claude-sonnet-4-6",
    fallback=(
        ModelChoice("bedrock", "in.anthropic.claude-haiku-4-5-20251001-v1:0"),
        # Nova Lite before Nova Pro: more accurate and cheaper as judge (docs/ml/eval.md).
        ModelChoice("bedrock", "apac.amazon.nova-lite-v1:0"),
        ModelChoice("bedrock", "apac.amazon.nova-pro-v1:0"),
        ModelChoice("openai", "gpt-4.1-mini"),
    ),
)


class ModelChoiceModel(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    provider: Literal["bedrock", "openai"]
    model: str = Field(min_length=1)


class TaskConfigModel(ModelChoiceModel):
    fallback: tuple[ModelChoiceModel, ...] = ()

    def to_domain(self) -> TaskConfig:
        fallback = tuple(ModelChoice(item.provider, item.model) for item in self.fallback)
        return TaskConfig(self.provider, self.model, fallback)


class LlmSettings(EnvSettings):
    openai_secret_id: str = Field(default="", alias="OPENAI_SECRET_ID")
    llm_tasks: dict[str, TaskConfigModel] = Field(default_factory=dict, alias="LLM_TASKS")

    def task_configs(self) -> dict[str, TaskConfig]:
        """Defaults for every task, replaced task by task by LLM_TASKS."""
        overrides = {task: config.to_domain() for task, config in self.llm_tasks.items()}
        return {task: DEFAULT_TASK_CONFIG for task in TASKS} | overrides

    def openai_secret(self, stage: str) -> str:
        return self.openai_secret_id or f"junksnap/{stage}/openai-api-key"
