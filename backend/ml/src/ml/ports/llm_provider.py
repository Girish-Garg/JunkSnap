"""Ports of the LLM layer: a provider bound to one model, and its builder."""

from abc import ABC, abstractmethod

from ml.domain.llm import LlmRequest, LlmResponse


class LlmProvider(ABC):
    @abstractmethod
    def complete(self, request: LlmRequest) -> LlmResponse:
        """Raises ProviderError when the call fails."""


class ProviderBuilder(ABC):
    @abstractmethod
    def build(self, model: str) -> LlmProvider | None:
        """None when the provider cannot run, for example without an API key."""
