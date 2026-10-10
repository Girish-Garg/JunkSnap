"""Strategy for turning signal scores into one probability and a decision."""

from abc import ABC, abstractmethod
from collections.abc import Sequence

from ml.domain.case import CombinerInfo
from ml.domain.purposes import Purpose
from ml.domain.verification import Claim, Outcome, SignalResult, Thresholds


class Combiner(ABC):
    """The judge runs on every case first; the combiner weighs it with the detectors."""

    @property
    @abstractmethod
    def thresholds(self) -> Thresholds: ...

    @abstractmethod
    def info(self) -> CombinerInfo: ...

    @abstractmethod
    def for_claim(self, claim: Claim, signals: Sequence[SignalResult] = ()) -> "Combiner":
        """The combiner that decides this claim; one not fitted for the claim hands over."""

    @abstractmethod
    def combine(self, signals: Sequence[SignalResult], purpose: Purpose) -> Outcome: ...
