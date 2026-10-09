"""LlmProvider over the OpenAI Chat Completions API (the judge's fallback after Bedrock)."""

import base64
import time
from typing import Any

import httpx

from ml.domain.errors import ProviderError
from ml.domain.llm import LlmRequest, LlmResponse
from ml.ports.llm_provider import LlmProvider, ProviderBuilder
from ml.ports.secret_reader import SecretReader

PROVIDER = "openai"
BASE_URL = "https://api.openai.com/v1"
PLACEHOLDER_PREFIXES = ("placeholder", "replace", "changeme", "todo", "<")


class OpenAiCompatibleProvider(LlmProvider):
    def __init__(self, http: httpx.Client, api_key: str, model: str) -> None:
        self._http = http
        self._api_key = api_key
        self._model = model

    def complete(self, request: LlmRequest) -> LlmResponse:
        started = time.monotonic()
        data = self._post(self._body(request))
        try:
            text = data["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, TypeError) as error:
            raise ProviderError(f"{PROVIDER} {self._model}: no answer") from error
        usage = data.get("usage") or {}
        return LlmResponse(
            text=text,
            provider=PROVIDER,
            model=self._model,
            version=str(data.get("model") or self._model),  # the snapshot that actually served
            latency_ms=round((time.monotonic() - started) * 1000),
            input_tokens=int(usage.get("prompt_tokens") or 0),
            output_tokens=int(usage.get("completion_tokens") or 0),
        )

    def _body(self, request: LlmRequest) -> dict[str, object]:
        content: list[dict[str, object]] = [
            {"type": "image_url", "image_url": {"url": self._data_url(image.mime_type, image.data)}}
            for image in request.images
        ]
        content.append({"type": "text", "text": request.prompt})
        body: dict[str, object] = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": request.system},
                {"role": "user", "content": content},
            ],
            "max_completion_tokens": request.max_tokens,
            "temperature": request.temperature,
        }
        if request.json_mode:
            body["response_format"] = {"type": "json_object"}
        return body

    def _post(self, body: dict[str, object]) -> dict[str, Any]:
        name = f"{PROVIDER} {self._model}"
        try:
            response = self._http.post(
                f"{BASE_URL}/chat/completions",
                json=body,
                headers={"Authorization": f"Bearer {self._api_key}"},
            )
        except httpx.HTTPError as error:
            raise ProviderError(f"{name}: {type(error).__name__}") from error
        if response.status_code >= httpx.codes.BAD_REQUEST:
            raise ProviderError(f"{name}: HTTP {response.status_code}")
        data: dict[str, Any] = response.json()
        return data

    @staticmethod
    def _data_url(mime_type: str, data: bytes) -> str:
        return f"data:{mime_type};base64,{base64.b64encode(data).decode('ascii')}"


class OpenAiProviderBuilder(ProviderBuilder):
    """Builds nothing (the provider is skipped) while the key is missing or a placeholder."""

    def __init__(self, http: httpx.Client, secrets: SecretReader, secret_id: str) -> None:
        self._http = http
        self._secrets = secrets
        self._secret_id = secret_id

    def build(self, model: str) -> LlmProvider | None:
        key = (self._secrets.read(self._secret_id) or "").strip()
        if not key or key.lower().startswith(PLACEHOLDER_PREFIXES):
            return None
        return OpenAiCompatibleProvider(self._http, key, model)
