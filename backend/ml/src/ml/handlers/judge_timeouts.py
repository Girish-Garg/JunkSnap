"""Short timeouts for Bedrock model calls (judge, Titan) and OpenAI: a hung model hands over."""

from dataclasses import dataclass

import httpx
from botocore.config import Config

from ml.ports.clock import Clock
from ml.services.attempt_window import AttemptWindow
from ml.settings.timing import (
    ATTEMPTS,
    CONNECT_TIMEOUT_S,
    DETECTORS_S,
    READ_TIMEOUT_S,
    WORKER_BUDGET_S,
    TimingSettings,
)


@dataclass(frozen=True)
class JudgeTimeouts:
    read_s: float = READ_TIMEOUT_S
    connect_s: float = CONNECT_TIMEOUT_S
    attempts: int = ATTEMPTS
    budget_s: float = WORKER_BUDGET_S - DETECTORS_S  # the judge's share of the worker's wait

    @staticmethod
    def of(timing: TimingSettings) -> "JudgeTimeouts":
        return JudgeTimeouts(
            timing.judge_read_timeout_s,
            timing.judge_connect_timeout_s,
            timing.judge_attempts,
            timing.judge_budget_s(),
        )

    def window(self, clock: Clock) -> AttemptWindow:
        """The judge's 50 s: an attempt (an invalid-answer retry too) starts only if its longest
        run ends inside it, a resent Bedrock call 16 s (by 34 s), OpenAI 8 s (by 42 s)."""
        longest = {"bedrock": self.attempts * self.read_s, "openai": self.read_s}
        return AttemptWindow(clock, self.budget_s, longest)

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
