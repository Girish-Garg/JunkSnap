"""LlmProvider over the Bedrock Converse API."""

import re
import time
from typing import TYPE_CHECKING

from botocore.exceptions import BotoCoreError, ClientError

from ml.domain.errors import ProviderError
from ml.domain.llm import LlmRequest, LlmResponse
from ml.ports.llm_provider import LlmProvider, ProviderBuilder

if TYPE_CHECKING:
    from mypy_boto3_bedrock_runtime import BedrockRuntimeClient
    from mypy_boto3_bedrock_runtime.type_defs import ContentBlockTypeDef, ConverseResponseTypeDef

PROVIDER = "bedrock"
_DATED_VERSION = re.compile(r"-(\d{8}-v\d+:\d+|v\d+:\d+)$")
_NAME_VERSION = re.compile(r"-(\d+)-(\d+)$")


class BedrockConverseProvider(LlmProvider):
    """One Bedrock model or inference profile; JSON comes from the prompt, not outputConfig."""

    def __init__(self, client: "BedrockRuntimeClient", model: str) -> None:
        self._client = client
        self._model = model

    def complete(self, request: LlmRequest) -> LlmResponse:
        started = time.monotonic()
        response = self._converse(request)
        usage = response["usage"]
        return LlmResponse(
            text=self._text(response),
            provider=PROVIDER,
            model=self._model,
            version=self.version_of(self._model),
            latency_ms=round((time.monotonic() - started) * 1000),
            input_tokens=usage["inputTokens"],
            output_tokens=usage["outputTokens"],
        )

    @staticmethod
    def version_of(model: str) -> str:
        """`...-20251001-v1:0` and `...-v1:0` keep their suffix; `...claude-sonnet-4-6` is 4.6."""
        dated = _DATED_VERSION.search(model)
        if dated:
            return dated.group(1)
        named = _NAME_VERSION.search(model)
        return f"{named.group(1)}.{named.group(2)}" if named else "unversioned"

    def _converse(self, request: LlmRequest) -> "ConverseResponseTypeDef":
        content: list[ContentBlockTypeDef] = [
            {"image": {"format": image.format, "source": {"bytes": image.data}}}
            for image in request.images
        ]
        content.append({"text": request.prompt})
        try:
            return self._client.converse(
                modelId=self._model,
                system=[{"text": request.system}],
                messages=[{"role": "user", "content": content}],
                inferenceConfig={
                    "maxTokens": request.max_tokens,
                    "temperature": request.temperature,
                },
            )
        except (BotoCoreError, ClientError) as error:
            raise ProviderError(f"bedrock {self._model}: {error}") from error

    @staticmethod
    def _text(response: "ConverseResponseTypeDef") -> str:
        blocks = response["output"].get("message", {}).get("content", [])
        return "".join(block.get("text", "") for block in blocks)


class BedrockProviderBuilder(ProviderBuilder):
    """Bedrock needs no key: access comes from EKS Pod Identity or the CLI profile."""

    def __init__(self, client: "BedrockRuntimeClient") -> None:
        self._client = client

    def build(self, model: str) -> LlmProvider:
        return BedrockConverseProvider(self._client, model)
