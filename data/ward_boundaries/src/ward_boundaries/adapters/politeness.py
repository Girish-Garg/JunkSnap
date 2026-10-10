"""Polite GETs (as in the ward crawler): robots.txt per host, throttle every hop, Retry-After."""

import time
from collections.abc import Callable
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

import httpx

from ward_boundaries.domain.models import WardBoundariesError

MAX_REDIRECTS = 5
MAX_RETRY_AFTER_S = 120.0
DEFAULT_RETRY_AFTER_S = 30.0


class Politeness:
    def __init__(
        self,
        client: httpx.Client,
        user_agent: str,
        interval_s: float = 1.0,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._client = client
        self._agent = user_agent
        self._interval_s = interval_s
        self._sleep = sleep
        self._robots: dict[str, RobotFileParser | None] = {}
        self._next_at: dict[str, float] = {}

    def get(self, url: str) -> httpx.Response:
        """Follows redirects by hand, so each hop's host is checked and throttled."""
        target = url
        for _ in range(MAX_REDIRECTS + 1):
            response = self._hop(target)
            if not response.is_redirect:
                return response
            target = str(response.url.join(response.headers["location"]))
        raise WardBoundariesError(f"more than {MAX_REDIRECTS} redirects from {url}")

    def _hop(self, url: str) -> httpx.Response:
        if not self._allowed(url):
            raise WardBoundariesError(f"robots.txt disallows {url}")
        self._wait(url)
        response = self._client.get(url)
        if response.status_code not in (429, 503):
            return response
        value = response.headers.get("retry-after", "")
        delay = float(value) if value.strip().isdigit() else DEFAULT_RETRY_AFTER_S
        self._hold(url, min(delay, MAX_RETRY_AFTER_S))
        self._wait(url)
        return self._client.get(url)

    def _allowed(self, url: str) -> bool:
        parts = urlsplit(url)
        origin = f"{parts.scheme}://{parts.netloc}"
        if origin not in self._robots:
            self._robots[origin] = self._load(origin)
        rules = self._robots[origin]
        return rules is None or rules.can_fetch(self._agent, url)

    def _load(self, origin: str) -> RobotFileParser | None:
        """No or unreachable robots.txt means no rules; 401 or 403 means keep out."""
        self._wait(origin)
        try:
            response = self._client.get(f"{origin}/robots.txt")
        except httpx.HTTPError:
            return None
        rules = RobotFileParser()
        if response.status_code in (401, 403):
            rules.parse(["User-agent: *", "Disallow: /"])
        elif response.is_error:
            return None
        else:
            rules.parse(response.text.splitlines())
        return rules

    def _wait(self, url: str) -> None:
        host = urlsplit(url).netloc.lower()
        delay = self._next_at.get(host, 0.0) - time.monotonic()
        if delay > 0:
            self._sleep(delay)
        self._next_at[host] = time.monotonic() + self._interval_s

    def _hold(self, url: str, seconds: float) -> None:
        self._next_at[urlsplit(url).netloc.lower()] = time.monotonic() + seconds
