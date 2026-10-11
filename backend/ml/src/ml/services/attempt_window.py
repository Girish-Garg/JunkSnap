"""A job's time budget: no new model attempt starts once its window has closed."""

from datetime import datetime, timedelta

from ml.ports.clock import Clock


class OpenWindow:
    """One job's window, closed once its time has passed."""

    def __init__(self, clock: Clock, closes_at: datetime) -> None:
        self._clock = clock
        self._closes_at = closes_at

    def closed(self) -> bool:
        return self._clock.now() >= self._closes_at


class AttemptWindow:
    """Opened as a job starts; every attempt checks it first, so the last one starts in time.

    The judge's is JudgeTimeouts.last_start_s: its longest attempt still ends in the budget.
    """

    def __init__(self, clock: Clock, seconds: float) -> None:
        self._clock = clock
        self._seconds = seconds

    def open(self) -> OpenWindow:
        return OpenWindow(self._clock, self._clock.now() + timedelta(seconds=self._seconds))
