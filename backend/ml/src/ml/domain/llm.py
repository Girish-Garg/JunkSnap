"""Value objects of the model-agnostic LLM layer."""

from dataclasses import dataclass, replace

from ml.domain.images import BlurredImage


@dataclass(frozen=True)
class ModelChoice:
    provider: str
    model: str

    def label(self) -> str:
        return f"{self.provider}:{self.model}"


@dataclass(frozen=True)
class TaskConfig:
    provider: str
    model: str
    fallback: tuple[ModelChoice, ...] = ()

    def choices(self) -> tuple[ModelChoice, ...]:
        return (ModelChoice(self.provider, self.model), *self.fallback)


@dataclass(frozen=True)
class LlmRequest:
    system: str
    prompt: str
    images: tuple[BlurredImage, ...] = ()  # blurred by construction
    json_mode: bool = True
    max_tokens: int = 800
    temperature: float = 0.0

    def with_reminder(self, reminder: str) -> "LlmRequest":
        return replace(self, prompt=f"{self.prompt}\n\n{reminder}")


@dataclass(frozen=True)
class LlmResponse:
    text: str
    provider: str
    model: str
    version: str
    latency_ms: int
    input_tokens: int = 0
    output_tokens: int = 0
