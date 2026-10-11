"""botocore client configs from TimingSettings: fast detector calls, patient model downloads."""

from botocore.config import Config

from ml.settings.timing import TimingSettings


class ClientConfigs:
    def __init__(self, timing: TimingSettings) -> None:
        self._timing = timing

    def detectors(self) -> Config:
        """Rekognition, S3 and Secrets Manager: a hung call fails inside the detectors' budget."""
        t = self._timing
        return self._standard(t.aws_attempts, t.aws_connect_timeout_s, t.aws_read_timeout_s)

    def model_files(self) -> Config:
        t = self._timing
        return self._standard(
            t.model_download_attempts,
            t.model_download_connect_timeout_s,
            t.model_download_read_timeout_s,
        )

    def offline(self) -> Config:
        """Offline scoring waits out throttling instead of failing over."""
        t = self._timing
        return Config(
            retries={"max_attempts": t.offline_retries, "mode": "adaptive"},
            read_timeout=t.offline_read_timeout_s,
        )

    @staticmethod
    def _standard(attempts: int, connect_s: float, read_s: float) -> Config:
        """Standard retries; `total_max_attempts` counts the first call."""
        return Config(
            retries={"total_max_attempts": attempts, "mode": "standard"},
            connect_timeout=connect_s,
            read_timeout=read_s,
        )
