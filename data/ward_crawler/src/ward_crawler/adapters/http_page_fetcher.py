"""Fetches official pages politely and caches their text, hash and fetch time."""

import hashlib
from datetime import UTC, datetime

import httpx

from ward_crawler.adapters.page_cache import PageCache
from ward_crawler.adapters.page_text import PageTextReader
from ward_crawler.adapters.politeness import Politeness
from ward_crawler.domain.errors import FetchError
from ward_crawler.domain.sources import Page
from ward_crawler.ports.page_fetcher import PageFetcher

USER_AGENT = (
    "JunkSnap-ward-crawler/0.1 (civic waste reporting research; "
    "+https://github.com/Girish-Garg/saboot)"
)
MAX_REDIRECTS = 5


class HttpPageFetcher(PageFetcher):
    """Follows redirects itself, so every hop (and the final host) is throttled and checked."""

    def __init__(self, polite: Politeness, cache: PageCache, reader: PageTextReader) -> None:
        self._polite = polite
        self._cache = cache
        self._reader = reader

    def fetch(self, url: str) -> Page:
        cached = self._cache.get(url)
        if cached is not None:
            return cached
        page = self._download(url)
        self._cache.put(page)
        return page

    def _download(self, url: str) -> Page:
        try:
            response = self._follow(url)
            response.raise_for_status()
        except httpx.HTTPError as error:
            raise FetchError(f"{type(error).__name__}: {error}") from error
        content_type = response.headers.get("content-type", "")
        text = self._reader.read(response.content, content_type, response.encoding or "utf-8")
        digest = hashlib.sha256(response.content).hexdigest()
        return Page(url=url, text=text, sha256=digest, fetched_at=datetime.now(UTC))

    def _follow(self, url: str) -> httpx.Response:
        target = url
        for _ in range(MAX_REDIRECTS + 1):
            response = self._polite.get(target)
            if not response.is_redirect:
                return response
            target = str(response.url.join(response.headers["location"]))
        raise FetchError(f"more than {MAX_REDIRECTS} redirects from {url}")
