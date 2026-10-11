"""Every ML tuning variable (contracts/README.md, workload ml), read once at startup."""

from dataclasses import dataclass

from ml.settings.gates import GateSettings
from ml.settings.images import ImageSettings
from ml.settings.judge import JudgeSettings
from ml.settings.signals import SignalSettings
from ml.settings.timing import TimingSettings


@dataclass(frozen=True)
class Tuning:
    gates: GateSettings
    signals: SignalSettings
    judge: JudgeSettings
    timing: TimingSettings
    images: ImageSettings

    @staticmethod
    def load() -> "Tuning":
        """Unset variables keep today's values; a bad one is a ConfigError at startup."""
        return Tuning(
            GateSettings.load(),
            SignalSettings.load(),
            JudgeSettings.load(),
            TimingSettings.load(),
            ImageSettings.load(),
        )
