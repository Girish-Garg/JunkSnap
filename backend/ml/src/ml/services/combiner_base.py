"""Strategy for turning signal scores into one probability and a decision."""

from abc import ABC, abstractmethod
from collections.abc import Sequence

from ml.domain.case import CombinerInfo
from ml.domain.purposes import Purpose
from ml.domain.verification import Outcome, SignalResult, Thresholds


class Combiner(ABC):
    @property
    @abstractmethod
    def thresholds(self) -> Thresholds: ...

    @abstractmethod
    def info(self) -> CombinerInfo: ...

    @abstractmethod
    def needs_judge(self, signals: Sequence[SignalResult], purpose: Purpose) -> bool: ...

    @abstractmethod
    def combine(self, signals: Sequence[SignalResult], purpose: Purpose) -> Outcome: ...
