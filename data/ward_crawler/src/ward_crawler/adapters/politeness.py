"""Polite GETs: robots.txt read once per host, one request per interval per host, Retry-After."""

from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

import httpx

from ward_crawler.adapters.host_throttle import HostThrottle
from ward_crawler.domain.errors import FetchError

MAX_RETRY_AFTER_S = 120.0
DEFAULT_RETRY_AFTER_S = 30.0


class Politeness:
    def __init__(self, client: httpx.Client, throttle: HostThrottle, user_agent: str) -> None:
        self._client = client
        self._throttle = throttle
        self._agent = user_agent
        self._robots: dict[str, RobotFileParser | None] = {}

    def get(self, url: str) -> httpx.Response:
        """One hop, no redirects followed; a 429 or 503 with Retry-After is retried once."""
        if not self._allowed(url):
            raise FetchError(f"robots.txt disallows {url}")
        self._throttle.wait(url)
        response = self._client.get(url)
        delay = self._retry_after(response)
        if delay is None:
            return response
        self._throttle.hold(url, delay)
        self._throttle.wait(url)
        return self._client.get(url)

    def _allowed(self, url: str) -> bool:
        parts = urlsplit(url)
        origin = f"{parts.scheme}://{parts.netloc}"
        if origin not in self._robots:
            self._robots[origin] = self._load(origin)
        rules = self._robots[origin]
        return rules is None or rules.can_fetch(self._agent, url)

    def _load(self, origin: str) -> RobotFileParser | None:
        """No robots.txt (or an unreachable one) means no rules; 401 or 403 means keep out."""
        self._throttle.wait(origin)
        try:
            response = self._client.get(f"{origin}/robots.txt")
        except httpx.HTTPError:
            return None
        rules = RobotFileParser()
        if response.status_code in (401, 403):
            rules.parse(["User-agent: *", "Disallow: /"])
        elif response.status_code >= 400:  # noqa: PLR2004
            return None
        else:
            rules.parse(response.text.splitlines())
        return rules

    def _retry_after(self, response: httpx.Response) -> float | None:
        if response.status_code not in (429, 503):
            return None
        value = response.headers.get("retry-after", "")
        seconds = float(value) if value.strip().isdigit() else DEFAULT_RETRY_AFTER_S
        return min(seconds, MAX_RETRY_AFTER_S)
