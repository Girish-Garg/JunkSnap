"""Politeness: at most one request per interval to each host."""

import time
from collections.abc import Callable
from urllib.parse import urlsplit


class HostThrottle:
    def __init__(
        self,
        interval_s: float = 1.0,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._interval_s = interval_s
        self._clock = clock
        self._sleep = sleep
        self._last: dict[str, float] = {}

    def wait(self, url: str) -> None:
        host = urlsplit(url).netloc.lower()
        last = self._last.get(host)
        if last is not None:
            delay = last + self._interval_s - self._clock()
            if delay > 0:
                self._sleep(delay)
        self._last[host] = self._clock()

    def hold(self, url: str, seconds: float) -> None:
        """The host asked for a pause (Retry-After): the next wait lasts at least `seconds`."""
        host = urlsplit(url).netloc.lower()
        self._last[host] = self._clock() + seconds - self._interval_s
