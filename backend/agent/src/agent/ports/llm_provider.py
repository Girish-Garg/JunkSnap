"""Ports of the LLM layer: one provider bound to one model, and the builder that makes it."""

from abc import ABC, abstractmethod

from agent.domain.llm import LlmRequest, LlmResponse


class LlmProvider(ABC):
    """Strategy: one provider and model. Bedrock, OpenAI and OpenRouter implement it."""

    @abstractmethod
    def complete(self, request: LlmRequest) -> LlmResponse:
        """Answer one request. Raises ProviderError when the call fails."""


class ProviderBuilder(ABC):
    """Builds the LlmProvider for one model of one provider."""

    @abstractmethod
    def build(self, model: str) -> LlmProvider | None:
        """The provider for `model`, or None when it cannot run (for example no API key)."""
