"""A hung judge provider times out, is retried once, and hands over to the next model."""

import socket
import threading
import time
from collections.abc import Iterator

import boto3
import httpx
import pytest
from botocore import UNSIGNED
from botocore.config import Config
from fakes import JUDGE_JSON, FakeBuilder, FakeProvider

from ml.adapters.bedrock_converse import BedrockConverseProvider
from ml.domain.llm import LlmRequest, ModelChoice, TaskConfig
from ml.domain.pricing import PriceTable
from ml.handlers.judge_timeouts import JudgeTimeouts
from ml.services.judge_answer import JudgeAnswer
from ml.services.provider_factory import ProviderFactory
from ml.services.provider_router import JsonJob, ProviderRouter

LITE = "apac.amazon.nova-lite-v1:0"
PRO = "apac.amazon.nova-pro-v1:0"
FAST = JudgeTimeouts(read_s=0.3, connect_s=0.3)


class HungServer:
    """Accepts TCP connections on loopback and never answers."""

    def __init__(self) -> None:
        self._socket = socket.create_server(("127.0.0.1", 0))
        self._socket.settimeout(0.1)
        self._open: list[socket.socket] = []
        self._running = True
        self._thread = threading.Thread(target=self._accept, daemon=True)
        self._thread.start()

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self._socket.getsockname()[1]}"

    @property
    def connections(self) -> int:
        return len(self._open)

    def _accept(self) -> None:
        while self._running:
            try:
                self._open.append(self._socket.accept()[0])
            except TimeoutError:
                continue

    def close(self) -> None:
        self._running = False
        self._thread.join()
        for connection in (*self._open, self._socket):
            connection.close()


@pytest.fixture
def hung() -> Iterator[HungServer]:
    server = HungServer()
    yield server
    server.close()


def test_defaults_fit_the_workers_60_s_budget() -> None:
    config = JudgeTimeouts().aws_config()
    assert config.read_timeout == 15.0
    assert config.retries == {"total_max_attempts": 2, "mode": "standard"}
    assert JudgeTimeouts().http_client().timeout.read == 15.0


def test_a_hung_bedrock_model_is_retried_once_then_the_next_answers(hung: HungServer) -> None:
    config = FAST.aws_config().merge(Config(signature_version=UNSIGNED))
    client = boto3.session.Session(region_name="ap-south-1").client(
        "bedrock-runtime", endpoint_url=hung.url, config=config
    )
    pro = FakeProvider(PRO, [JUDGE_JSON])
    builder = FakeBuilder({LITE: BedrockConverseProvider(client, LITE), PRO: pro})
    task = TaskConfig("bedrock", LITE, (ModelChoice("bedrock", PRO),))
    router = ProviderRouter({"judge": task}, ProviderFactory({"bedrock": builder}), PriceTable())
    started = time.monotonic()

    answer = router.complete_json(JsonJob("judge", LlmRequest("system", "judge"), JudgeAnswer))

    assert answer.response.model == PRO
    assert hung.connections == FAST.attempts
    assert time.monotonic() - started < 10


def test_a_hung_openai_call_times_out(hung: HungServer) -> None:
    started = time.monotonic()
    with pytest.raises(httpx.ReadTimeout):
        FAST.http_client().post(hung.url, json={})
    assert time.monotonic() - started < 3
