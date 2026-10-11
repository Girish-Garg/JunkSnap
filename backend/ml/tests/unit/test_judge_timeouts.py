"""A hung judge provider times out, is retried once, and hands over to the next model."""

import socket
import threading
import time
from collections.abc import Iterator
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import boto3
import httpx
import pytest
from botocore import UNSIGNED
from botocore.config import Config
from fakes import FIXED_NOW, JUDGE_JSON, FakeBuilder, FakeProvider

from ml.adapters.bedrock_converse import BedrockConverseProvider
from ml.adapters.s3_model_store import S3ModelStore
from ml.domain.errors import ExternalServiceError, NoProviderAnsweredError
from ml.domain.llm import LlmRequest, LlmResponse, ModelChoice, TaskConfig
from ml.domain.model_files import PinnedModel
from ml.domain.pricing import PriceTable
from ml.handlers.judge_timeouts import (
    ATTEMPTS,
    DETECTORS_S,
    READ_TIMEOUT_S,
    WORKER_BUDGET_S,
    JudgeTimeouts,
)
from ml.handlers.verify_graph import VerifierBuilder
from ml.ports.clock import Clock
from ml.services.attempt_window import AttemptWindow
from ml.services.judge_answer import JudgeAnswer
from ml.services.provider_factory import ProviderFactory
from ml.services.provider_router import JsonJob, ProviderRouter
from ml.settings.core import CoreSettings
from ml.settings.llm import LlmSettings
from ml.settings.models import ModelSettings

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


def test_defaults_are_8_s_reads_and_one_resend() -> None:
    config = JudgeTimeouts().aws_config()
    assert config.read_timeout == 8.0
    assert config.retries == {"total_max_attempts": 2, "mode": "standard"}
    assert JudgeTimeouts().http_client().timeout.read == 8.0


def test_nova_lite_nova_pro_and_openai_all_hung_fit_the_workers_budget() -> None:
    t = JudgeTimeouts()
    worst = 2 * (t.attempts * t.read_s) + t.read_s  # two Bedrock models, then OpenAI
    assert worst < WORKER_BUDGET_S - DETECTORS_S


def test_the_verify_graph_gives_every_bedrock_client_and_openai_the_timeouts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    timeouts = JudgeTimeouts(read_s=7.5, connect_s=2.5)
    configs: list[tuple[str, Any]] = []
    clients: list[httpx.Client] = []
    real_client, real_http = boto3.session.Session.client, JudgeTimeouts.http_client

    def client(self: boto3.session.Session, name: str, **kwargs: Any) -> Any:
        configs.append((name, kwargs.get("config")))
        return real_client(self, name, **kwargs)  # type: ignore[call-overload]

    def http_client(self: JudgeTimeouts) -> httpx.Client:
        clients.append(real_http(self))
        return clients[-1]

    def refuse(self: S3ModelStore, model: PinnedModel) -> Path:
        raise ExternalServiceError("offline test")  # after the Titan client is made

    monkeypatch.setattr(boto3.session.Session, "client", client)
    monkeypatch.setattr(JudgeTimeouts, "http_client", http_client)
    monkeypatch.setattr(S3ModelStore, "fetch", refuse)
    models = ModelSettings(ORIGINALS_BUCKET="bucket")
    VerifierBuilder(CoreSettings(), LlmSettings(), models, timeouts).verifier()

    bedrock = [config for name, config in configs if name == "bedrock-runtime"]
    assert len(bedrock) == 2  # Titan embeddings and the judge
    assert all(c.read_timeout == 7.5 and c.connect_timeout == 2.5 for c in bedrock)
    assert all(c.retries["total_max_attempts"] == 2 for c in bedrock)
    assert [c.timeout.read for c in clients] == [7.5]


def test_the_detector_clients_fail_fast(monkeypatch: pytest.MonkeyPatch) -> None:
    """Rekognition and the S3 reads: one resend at most, both inside the detectors' 10 s."""
    configs: dict[str, Any] = {}
    real_client = boto3.session.Session.client

    def client(self: boto3.session.Session, name: str, **kwargs: Any) -> Any:
        configs.setdefault(name, kwargs.get("config"))
        return real_client(self, name, **kwargs)  # type: ignore[call-overload]

    monkeypatch.setattr(boto3.session.Session, "client", client)
    builder = VerifierBuilder(CoreSettings(), LlmSettings(), ModelSettings())
    builder.verifier()
    builder.image_store("bucket")

    for name in ("rekognition", "s3"):
        assert configs[name].retries == {"total_max_attempts": 2, "mode": "standard"}
        assert configs[name].connect_timeout <= 2
        assert 2 * configs[name].read_timeout <= DETECTORS_S


def test_the_last_judge_attempt_starts_in_time_to_end_inside_the_budget() -> None:
    t = JudgeTimeouts()
    assert t.last_start_s + t.attempts * t.read_s <= WORKER_BUDGET_S - DETECTORS_S
    assert t.last_start_s > 2 * t.attempts * t.read_s  # Lite and Pro hung: OpenAI still runs


class SteppingClock(Clock):
    def __init__(self) -> None:
        self.at = FIXED_NOW

    def now(self) -> datetime:
        return self.at


class SlowInvalidProvider(FakeProvider):
    """Answers invalid JSON as late as a resent Bedrock call can (2 x 8 s)."""

    def __init__(self, name: str, clock: SteppingClock) -> None:
        super().__init__(name, ["not json"] * 4)
        self._clock = clock

    def complete(self, request: LlmRequest) -> LlmResponse:
        self._clock.at += timedelta(seconds=ATTEMPTS * READ_TIMEOUT_S)
        return super().complete(request)


def test_no_judge_attempt_starts_after_the_window_so_retries_fit_the_budget() -> None:
    clock = SteppingClock()
    lite, pro = SlowInvalidProvider(LITE, clock), SlowInvalidProvider(PRO, clock)
    task = TaskConfig("bedrock", LITE, (ModelChoice("bedrock", PRO),))
    factory = ProviderFactory({"bedrock": FakeBuilder({LITE: lite, PRO: pro})})
    window = AttemptWindow(clock, JudgeTimeouts().last_start_s)
    router = ProviderRouter({"judge": task}, factory, PriceTable(), window)

    with pytest.raises(NoProviderAnsweredError):
        router.complete_json(JsonJob("judge", LlmRequest("system", "judge"), JudgeAnswer))

    assert (len(lite.requests), len(pro.requests)) == (2, 1)
    assert (clock.at - FIXED_NOW).total_seconds() <= WORKER_BUDGET_S - DETECTORS_S


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
