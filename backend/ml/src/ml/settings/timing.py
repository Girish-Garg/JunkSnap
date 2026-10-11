"""Time limits: the worker's wait, the judge's model calls, AWS clients and model downloads."""

from typing import Self

from pydantic import Field, model_validator

from ml.settings.base import Attempts, Seconds, TunableSettings

# The worker waits 60 s for /internal/verify. With every judge model hung at once,
# Nova Lite 2 x 8 s + Nova Pro 2 x 8 s + OpenAI 8 s = 40 s, inside the 50 s left after
# 10 s for the detectors. A healthy Nova Lite answers in 1.5 s median (docs/ml/eval.md).
WORKER_BUDGET_S = 60.0
DETECTORS_S = 10.0
READ_TIMEOUT_S = 8.0
CONNECT_TIMEOUT_S = 3.0
ATTEMPTS = 2  # the first call and 1 retry


class TimingSettings(TunableSettings):
    # Must match how long the worker waits for /internal/verify.
    worker_budget_s: Seconds = Field(default=WORKER_BUDGET_S, alias="ML_WORKER_BUDGET_S")
    detectors_budget_s: Seconds = Field(default=DETECTORS_S, alias="ML_DETECTORS_BUDGET_S")
    # Every Bedrock model call (judge and Titan) and OpenAI.
    judge_read_timeout_s: Seconds = Field(default=READ_TIMEOUT_S, alias="ML_JUDGE_READ_TIMEOUT_S")
    judge_connect_timeout_s: Seconds = Field(
        default=CONNECT_TIMEOUT_S, alias="ML_JUDGE_CONNECT_TIMEOUT_S"
    )
    judge_attempts: Attempts = Field(default=ATTEMPTS, alias="ML_JUDGE_ATTEMPTS")
    # Rekognition, S3 and Secrets Manager: fail fast inside the detectors' budget.
    aws_read_timeout_s: Seconds = Field(default=4.0, alias="ML_AWS_READ_TIMEOUT_S")
    aws_connect_timeout_s: Seconds = Field(default=2.0, alias="ML_AWS_CONNECT_TIMEOUT_S")
    aws_attempts: Attempts = Field(default=2, alias="ML_AWS_ATTEMPTS")
    # Model files at app start (SigLIP 371 MB, YOLO 38 MB): a short read could break one.
    model_download_read_timeout_s: Seconds = Field(
        default=30.0, alias="ML_MODEL_DOWNLOAD_READ_TIMEOUT_S"
    )
    model_download_connect_timeout_s: Seconds = Field(
        default=5.0, alias="ML_MODEL_DOWNLOAD_CONNECT_TIMEOUT_S"
    )
    model_download_attempts: Attempts = Field(default=3, alias="ML_MODEL_DOWNLOAD_ATTEMPTS")
    # Offline scoring (score_cli) waits out throttling instead of failing over.
    offline_read_timeout_s: Seconds = Field(default=120.0, alias="ML_OFFLINE_READ_TIMEOUT_S")
    offline_retries: int = Field(default=8, ge=0, le=20, alias="ML_OFFLINE_RETRIES")

    @model_validator(mode="after")
    def _fits_the_worker(self) -> Self:
        if self.judge_budget_s() <= 0:
            raise ValueError("ML_DETECTORS_BUDGET_S must be below ML_WORKER_BUDGET_S")
        if self.judge_attempts * self.judge_read_timeout_s > self.judge_budget_s():
            raise ValueError(
                "ML_JUDGE_ATTEMPTS x ML_JUDGE_READ_TIMEOUT_S must fit"
                " ML_WORKER_BUDGET_S - ML_DETECTORS_BUDGET_S"
            )
        if self.aws_attempts * self.aws_read_timeout_s > self.detectors_budget_s:
            raise ValueError(
                "ML_AWS_ATTEMPTS x ML_AWS_READ_TIMEOUT_S must fit ML_DETECTORS_BUDGET_S"
            )
        return self

    def judge_budget_s(self) -> float:
        """The worker's wait less the detectors' share."""
        return self.worker_budget_s - self.detectors_budget_s
