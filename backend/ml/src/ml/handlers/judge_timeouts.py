"""Short timeouts for Bedrock model calls (judge, Titan) and OpenAI: a hung model hands over."""

from dataclasses import dataclass

import httpx
from botocore.config import Config

from ml.ports.clock import Clock
from ml.services.attempt_window import AttemptWindow

# The worker waits 60 s for /internal/verify. With every judge model hung at once,
# Nova Lite 2 x 8 s + Nova Pro 2 x 8 s + OpenAI 8 s = 40 s, inside the 50 s left after
# 10 s for the detectors. A healthy Nova Lite answers in 1.5 s median (docs/ml/eval.md).
WORKER_BUDGET_S = 60.0
DETECTORS_S = 10.0
READ_TIMEOUT_S = 8.0
CONNECT_TIMEOUT_S = 3.0
ATTEMPTS = 2  # the first call and 1 retry


@dataclass(frozen=True)
class JudgeTimeouts:
    read_s: float = READ_TIMEOUT_S
    connect_s: float = CONNECT_TIMEOUT_S
    attempts: int = ATTEMPTS

    def window(self, clock: Clock) -> AttemptWindow:
        """The judge's 50 s: an attempt (an invalid-answer retry too) starts only if its longest
        run ends inside it, a resent Bedrock call 16 s (by 34 s), OpenAI 8 s (by 42 s)."""
        longest = {"bedrock": self.attempts * self.read_s, "openai": self.read_s}
        return AttemptWindow(clock, WORKER_BUDGET_S - DETECTORS_S, longest)

    def aws_config(self) -> Config:
        """bedrock-runtime (judge and Titan): a timeout is resent once; the total counts both."""
        return Config(
            retries={"total_max_attempts": self.attempts, "mode": "standard"},
            connect_timeout=self.connect_s,
            read_timeout=self.read_s,
        )

    def http_client(self) -> httpx.Client:
        """For OpenAI; httpx retries only a failed connect, so a slow answer is not resent."""
        return httpx.Client(
            timeout=httpx.Timeout(self.read_s, connect=self.connect_s),
            transport=httpx.HTTPTransport(retries=self.attempts - 1),
        )
