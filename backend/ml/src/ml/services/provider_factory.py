"""Factory that turns a ModelChoice into a ready LlmProvider."""

from collections.abc import Mapping

from ml.domain.errors import ConfigError
from ml.domain.llm import ModelChoice
from ml.ports.llm_provider import LlmProvider, ProviderBuilder


class ProviderFactory:
    """A new provider is a new registered builder; results are kept so keys are read once."""

    def __init__(self, builders: Mapping[str, ProviderBuilder]) -> None:
        self._builders = dict(builders)
        self._built: dict[ModelChoice, LlmProvider | None] = {}

    def build(self, choice: ModelChoice) -> LlmProvider | None:
        """None when the provider is skipped, for example for want of an API key."""
        if choice not in self._built:
            self._built[choice] = self._builder(choice.provider).build(choice.model)
        return self._built[choice]

    def _builder(self, provider: str) -> ProviderBuilder:
        builder = self._builders.get(provider)
        if builder is None:
            raise ConfigError(f"no provider builder registered for {provider!r}")
        return builder
