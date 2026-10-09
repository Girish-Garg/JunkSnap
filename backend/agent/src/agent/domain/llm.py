"""Value objects of the model-agnostic LLM layer."""

from dataclasses import dataclass, replace

from agent.domain.images import BlurredImage


@dataclass(frozen=True)
class ModelChoice:
    """One provider and model to try, for example bedrock + global.anthropic.claude-sonnet-4-6."""

    provider: str
    model: str

    def label(self) -> str:
        return f"{self.provider}:{self.model}"


@dataclass(frozen=True)
class TaskConfig:
    """`{provider, model, fallback[]}` for one task: judge, brands, letters or crawler."""

    provider: str
    model: str
    fallback: tuple[ModelChoice, ...] = ()

    def choices(self) -> tuple[ModelChoice, ...]:
        """The first choice, then each fallback, in order."""
        return (ModelChoice(self.provider, self.model), *self.fallback)


@dataclass(frozen=True)
class LlmRequest:
    """One prompt for any provider. Images are blurred by construction."""

    system: str
    prompt: str
    images: tuple[BlurredImage, ...] = ()
    json_mode: bool = True
    max_tokens: int = 800
    temperature: float = 0.0

    def with_reminder(self, reminder: str) -> "LlmRequest":
        """The same request with a note appended, used to retry after an invalid answer."""
        return replace(self, prompt=f"{self.prompt}\n\n{reminder}")


@dataclass(frozen=True)
class LlmResponse:
    """A provider's answer plus what the evidence needs: provider, model, version, latency."""

    text: str
    provider: str
    model: str
    version: str
    latency_ms: int
    input_tokens: int = 0
    output_tokens: int = 0
