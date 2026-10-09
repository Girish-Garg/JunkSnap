import base64
import json
from typing import Any

import httpx
import pytest
from botocore.exceptions import ClientError
from fakes import JPEG, FakeSecrets

from ml.adapters.bedrock_converse import BedrockConverseProvider, BedrockProviderBuilder
from ml.adapters.openai_compatible import OpenAiProviderBuilder
from ml.adapters.secrets_manager import SecretsManagerSecretReader
from ml.domain.errors import ProviderError
from ml.domain.images import BlurredImage
from ml.domain.llm import LlmRequest

IMAGE = BlurredImage("media/reports/rpt_jdh_1.jpg", JPEG)
REQUEST = LlmRequest(system="judge", prompt="photo", images=(IMAGE,))
OPENAI_ANSWER = {
    "model": "gpt-4.1-mini-2025-04-14",
    "choices": [{"message": {"content": '{"ok": true}'}}],
    "usage": {"prompt_tokens": 900, "completion_tokens": 40},
}


def openai_builder(key: str | None, handler: Any) -> OpenAiProviderBuilder:
    secrets = FakeSecrets({"key": key} if key is not None else {})
    http = httpx.Client(transport=httpx.MockTransport(handler))
    return OpenAiProviderBuilder(http, secrets, "key")


@pytest.mark.parametrize("key", [None, "", "  ", "placeholder", "REPLACE_ME", "changeme"])
def test_openai_builder_skips_missing_or_placeholder_key(key: str | None) -> None:
    assert openai_builder(key, lambda request: httpx.Response(500)).build("gpt-4.1-mini") is None


def test_openai_sends_blurred_image_as_data_url_and_json_mode() -> None:
    sent: list[dict[str, Any]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        sent.append(json.loads(request.content))
        assert request.headers["Authorization"] == "Bearer sk-test"
        return httpx.Response(200, json=OPENAI_ANSWER)

    provider = openai_builder("sk-test", handler).build("gpt-4.1-mini")
    assert provider is not None
    response = provider.complete(REQUEST)

    body = sent[0]
    data_url = body["messages"][1]["content"][0]["image_url"]["url"]
    assert data_url == "data:image/jpeg;base64," + base64.b64encode(JPEG).decode()
    assert body["response_format"] == {"type": "json_object"}
    assert body["max_completion_tokens"] == REQUEST.max_tokens
    assert (response.provider, response.version) == ("openai", "gpt-4.1-mini-2025-04-14")
    assert (response.input_tokens, response.output_tokens) == (900, 40)


def test_openai_http_error_is_a_provider_error() -> None:
    provider = openai_builder("sk-test", lambda request: httpx.Response(429)).build("gpt-4.1-mini")
    assert provider is not None

    with pytest.raises(ProviderError, match="429"):
        provider.complete(REQUEST)


class FakeBedrockClient:
    def __init__(self, error: Exception | None = None) -> None:
        self.calls: list[dict[str, Any]] = []
        self._error = error

    def converse(self, **kwargs: Any) -> dict[str, Any]:
        self.calls.append(kwargs)
        if self._error:
            raise self._error
        return {
            "output": {"message": {"content": [{"text": '{"ok": true}'}]}},
            "usage": {"inputTokens": 2100, "outputTokens": 60},
        }


def test_bedrock_sends_image_block_and_reads_text() -> None:
    client = FakeBedrockClient()
    provider = BedrockProviderBuilder(client).build("apac.amazon.nova-pro-v1:0")  # type: ignore[arg-type]

    response = provider.complete(REQUEST)

    content = client.calls[0]["messages"][0]["content"]
    assert content[0] == {"image": {"format": "jpeg", "source": {"bytes": JPEG}}}
    assert content[1] == {"text": "photo"}
    assert client.calls[0]["system"] == [{"text": "judge"}]
    assert (response.text, response.version) == ('{"ok": true}', "v1:0")
    assert (response.input_tokens, response.output_tokens) == (2100, 60)


def test_bedrock_client_error_is_a_provider_error() -> None:
    error = ClientError({"Error": {"Code": "ThrottlingException", "Message": "slow"}}, "Converse")
    provider = BedrockProviderBuilder(FakeBedrockClient(error)).build("m")  # type: ignore[arg-type]

    with pytest.raises(ProviderError, match="ThrottlingException"):
        provider.complete(REQUEST)


@pytest.mark.parametrize(
    ("model", "version"),
    [
        ("global.anthropic.claude-sonnet-4-6", "4.6"),
        ("in.anthropic.claude-haiku-4-5-20251001-v1:0", "20251001-v1:0"),
        ("apac.amazon.nova-pro-v1:0", "v1:0"),
        ("some-model", "unversioned"),
    ],
)
def test_bedrock_version_from_model_id(model: str, version: str) -> None:
    assert BedrockConverseProvider.version_of(model) == version


def test_openai_answer_that_is_not_json_is_a_provider_error() -> None:
    builder = openai_builder("sk-test", lambda request: httpx.Response(200, text="<html>"))
    provider = builder.build("gpt-4.1-mini")
    assert provider is not None

    with pytest.raises(ProviderError, match="not JSON"):
        provider.complete(REQUEST)


def test_unreadable_image_format_is_a_provider_error() -> None:
    odd = LlmRequest("judge", "photo", images=(BlurredImage("media/reports/x.jpg", b"BM-bmp"),))
    bedrock = BedrockProviderBuilder(FakeBedrockClient()).build("m")  # type: ignore[arg-type]
    openai = openai_builder("sk-test", lambda request: httpx.Response(200, json=OPENAI_ANSWER))
    openai_provider = openai.build("gpt-4.1-mini")
    assert openai_provider is not None

    with pytest.raises(ProviderError):
        bedrock.complete(odd)
    with pytest.raises(ProviderError):
        openai_provider.complete(odd)


class FakeSecretsClient:
    def __init__(self, answers: list[Exception | str]) -> None:
        self._answers = answers

    def get_secret_value(self, SecretId: str) -> dict[str, str]:  # noqa: N803
        answer = self._answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return {"SecretString": answer}


def test_missing_secret_is_not_remembered() -> None:
    missing = ClientError({"Error": {"Code": "ResourceNotFoundException"}}, "GetSecretValue")
    client = FakeSecretsClient([missing, "sk-new"])
    reader = SecretsManagerSecretReader(client)  # type: ignore[arg-type]

    assert reader.read("junksnap/dev/openai-api-key") is None
    assert reader.read("junksnap/dev/openai-api-key") == "sk-new"
    assert reader.read("junksnap/dev/openai-api-key") == "sk-new"
