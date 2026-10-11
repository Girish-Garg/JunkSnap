"""A job's time budget: an attempt starts only if its longest run still ends inside it."""

from collections.abc import Mapping
from datetime import datetime, timedelta
from types import MappingProxyType

from ml.ports.clock import Clock


class OpenWindow:
    """One job's budget, counted from the moment it started."""

    def __init__(self, clock: Clock, ends_at: datetime, longest_s: Mapping[str, float]) -> None:
        self._clock = clock
        self._ends_at = ends_at
        self._longest_s = longest_s

    def fits(self, provider: str) -> bool:
        """True when an attempt on this provider, at its longest, still ends in the budget.

        A provider without a known longest attempt is given the longest known one.
        """
        longest = self._longest_s.get(provider, max(self._longest_s.values(), default=0.0))
        return self._clock.now() + timedelta(seconds=longest) <= self._ends_at


class AttemptWindow:
    """Opened as a job starts; every attempt (a retry too) asks it first (JudgeTimeouts.window).

    Each provider's longest attempt counts, not one cutoff for all: with Lite and Pro hung,
    OpenAI (8 s) may still start late, while a Bedrock retry (16 s) may not.
    """

    def __init__(self, clock: Clock, budget_s: float, longest_s: Mapping[str, float]) -> None:
        self._clock = clock
        self._budget_s = budget_s
        self._longest_s = MappingProxyType(dict(longest_s))

    def open(self) -> OpenWindow:
        ends_at = self._clock.now() + timedelta(seconds=self._budget_s)
        return OpenWindow(self._clock, ends_at, self._longest_s)
