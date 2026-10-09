"""Fetches official pages over HTTP politely and caches their text, hash and fetch time."""

import hashlib
from datetime import UTC, datetime

import httpx

from ward_crawler.adapters.host_throttle import HostThrottle
from ward_crawler.adapters.page_cache import PageCache
from ward_crawler.adapters.page_text import PageTextReader
from ward_crawler.domain.errors import FetchError
from ward_crawler.domain.sources import Page
from ward_crawler.ports.page_fetcher import PageFetcher

USER_AGENT = (
    "JunkSnap-ward-crawler/0.1 (civic waste reporting research; "
    "+https://github.com/Girish-Garg/saboot)"
)


class HttpPageFetcher(PageFetcher):
    def __init__(
        self,
        client: httpx.Client,
        cache: PageCache,
        throttle: HostThrottle,
        reader: PageTextReader,
    ) -> None:
        self._client = client
        self._cache = cache
        self._throttle = throttle
        self._reader = reader

    def fetch(self, url: str) -> Page:
        cached = self._cache.get(url)
        if cached is not None:
            return cached
        page = self._download(url)
        self._cache.put(page)
        return page

    def _download(self, url: str) -> Page:
        self._throttle.wait(url)
        try:
            response = self._client.get(url)
            response.raise_for_status()
        except httpx.HTTPError as error:
            raise FetchError(f"{type(error).__name__}: {error}") from error
        content_type = response.headers.get("content-type", "")
        text = self._reader.read(response.content, content_type, response.encoding or "utf-8")
        digest = hashlib.sha256(response.content).hexdigest()
        return Page(url=url, text=text, sha256=digest, fetched_at=datetime.now(UTC))
