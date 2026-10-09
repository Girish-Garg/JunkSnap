"""Factory that turns a ModelChoice into a ready LlmProvider, once per choice."""

from collections.abc import Mapping

from agent.domain.errors import ConfigError
from agent.domain.llm import ModelChoice
from agent.ports.llm_provider import LlmProvider, ProviderBuilder


class ProviderFactory:
    """Builds providers through the builder registered for each provider name.

    A new provider is a new ProviderBuilder registered here, never a new branch.
    Results are kept, so API keys are read once per process.
    """

    def __init__(self, builders: Mapping[str, ProviderBuilder]) -> None:
        self._builders = dict(builders)
        self._built: dict[ModelChoice, LlmProvider | None] = {}

    def build(self, choice: ModelChoice) -> LlmProvider | None:
        """The provider for this choice, or None when it is skipped (for example no key)."""
        if choice not in self._built:
            self._built[choice] = self._builder(choice.provider).build(choice.model)
        return self._built[choice]

    def _builder(self, provider: str) -> ProviderBuilder:
        builder = self._builders.get(provider)
        if builder is None:
            raise ConfigError(f"no provider builder registered for {provider!r}")
        return builder
