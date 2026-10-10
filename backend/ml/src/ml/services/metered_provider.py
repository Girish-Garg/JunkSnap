"""Decorators that record every LLM response, so offline benchmarks can report tokens and cost."""

from dataclasses import dataclass, field

from ml.domain.llm import LlmRequest, LlmResponse
from ml.ports.llm_provider import LlmProvider, ProviderBuilder


@dataclass
class UsageLog:
    """Responses in call order; only offline tools read it."""

    responses: list[LlmResponse] = field(default_factory=list)

    def record(self, response: LlmResponse) -> None:
        self.responses.append(response)


class MeteredProvider(LlmProvider):
    def __init__(self, inner: LlmProvider, usage: UsageLog) -> None:
        self._inner = inner
        self._usage = usage

    def complete(self, request: LlmRequest) -> LlmResponse:
        response = self._inner.complete(request)
        self._usage.record(response)
        return response


class MeteredBuilder(ProviderBuilder):
    def __init__(self, inner: ProviderBuilder, usage: UsageLog) -> None:
        self._inner = inner
        self._usage = usage

    def build(self, model: str) -> LlmProvider | None:
        provider = self._inner.build(model)
        return None if provider is None else MeteredProvider(provider, self._usage)
