"""Timeouts for the judge's provider clients: a hung model hands over to the next one."""

from dataclasses import dataclass

import httpx
from botocore.config import Config

# The worker waits 60 s for /internal/verify. Two attempts of 15 s on a hung Nova Lite
# still leave Nova Pro time to answer (median 1.8 s, docs/ml/eval.md).
READ_TIMEOUT_S = 15.0
CONNECT_TIMEOUT_S = 5.0
ATTEMPTS = 2  # the first call and 1 retry


@dataclass(frozen=True)
class JudgeTimeouts:
    read_s: float = READ_TIMEOUT_S
    connect_s: float = CONNECT_TIMEOUT_S
    attempts: int = ATTEMPTS

    def aws_config(self) -> Config:
        """bedrock-runtime: a read timeout is resent once; total_max_attempts counts both."""
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
