"""Tries a task's providers in order until one gives an answer that validates."""

import logging
from collections.abc import Mapping
from dataclasses import dataclass

from pydantic import BaseModel, ValidationError

from agent.domain.errors import ConfigError, NoProviderAnsweredError, ProviderError
from agent.domain.llm import LlmRequest, LlmResponse, ModelChoice, TaskConfig
from agent.domain.pricing import PriceTable
from agent.ports.llm_provider import LlmProvider
from agent.services.provider_factory import ProviderFactory
from agent.utils import json_object_text

logger = logging.getLogger(__name__)

RETRIES_ON_INVALID_JSON = 1
INVALID_JSON_REMINDER = (
    "Your previous answer was not valid JSON for the requested fields. "
    "Reply with exactly one JSON object and nothing else."
)


@dataclass(frozen=True)
class RoutedAnswer[M: BaseModel]:
    value: M
    response: LlmResponse


@dataclass(frozen=True)
class JsonJob[M: BaseModel]:
    task: str
    request: LlmRequest
    schema: type[M]


class ProviderRouter:
    """A call error moves on at once; an invalid answer is retried once, then moves on."""

    def __init__(
        self, tasks: Mapping[str, TaskConfig], factory: ProviderFactory, prices: PriceTable
    ) -> None:
        self._tasks = dict(tasks)
        self._factory = factory
        self._prices = prices

    def complete_json[M: BaseModel](self, job: JsonJob[M]) -> RoutedAnswer[M]:
        for choice in self._config(job.task).choices():
            provider = self._provider(job.task, choice)
            if provider is None:
                continue
            answer = self._ask(job, choice, provider)
            if answer is not None:
                return answer
        raise NoProviderAnsweredError(f"no provider gave a valid answer for task {job.task!r}")

    def _config(self, task: str) -> TaskConfig:
        config = self._tasks.get(task)
        if config is None:
            raise ConfigError(f"no TaskConfig for task {task!r}")
        return config

    def _provider(self, task: str, choice: ModelChoice) -> LlmProvider | None:
        try:
            provider = self._factory.build(choice)
        except ProviderError as error:
            self._log("llm_unavailable", task, choice, str(error))
            return None
        if provider is None:
            self._log("llm_skipped", task, choice, "no usable API key")
        return provider

    def _ask[M: BaseModel](
        self, job: JsonJob[M], choice: ModelChoice, provider: LlmProvider
    ) -> RoutedAnswer[M] | None:
        request = job.request
        for _ in range(1 + RETRIES_ON_INVALID_JSON):
            try:
                response = provider.complete(request)
            except ProviderError as error:
                self._log("llm_failed", job.task, choice, str(error))
                return None
            self._log_call(job.task, response)
            try:
                value = job.schema.model_validate_json(json_object_text(response.text))
            except ValidationError as error:
                self._log("llm_invalid_json", job.task, choice, f"{error.error_count()} errors")
                request = job.request.with_reminder(INVALID_JSON_REMINDER)
                continue
            return RoutedAnswer(value, response)
        return None

    def _log_call(self, task: str, response: LlmResponse) -> None:
        fields = {
            "task": task,
            "provider": response.provider,
            "model": response.model,
            "version": response.version,
            "latency_ms": response.latency_ms,
            "input_tokens": response.input_tokens,
            "output_tokens": response.output_tokens,
            "cost_usd_estimate": self._prices.estimate_usd(response),
        }
        logger.info("llm_call", extra={"fields": fields})

    def _log(self, event: str, task: str, choice: ModelChoice, reason: str) -> None:
        fields = {"task": task, "provider": choice.provider, "model": choice.model}
        logger.warning(event, extra={"fields": {**fields, "reason": reason}})
