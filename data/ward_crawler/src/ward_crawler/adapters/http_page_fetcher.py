"""Fetches official pages politely; a cached copy is revalidated and reused while unchanged."""

import hashlib
import logging
from datetime import UTC, datetime

import httpx

from ward_crawler.adapters.page_text import PageTextReader
from ward_crawler.adapters.politeness import Politeness
from ward_crawler.domain.errors import FetchError
from ward_crawler.domain.sources import Page
from ward_crawler.domain.stored_page import StoredPage
from ward_crawler.ports.page_fetcher import PageFetcher
from ward_crawler.ports.page_store import PageStore

USER_AGENT = (
    "JunkSnap-ward-crawler/0.1 (civic waste reporting research; "
    "+https://github.com/Girish-Garg/saboot)"
)
MAX_REDIRECTS = 5
NOT_MODIFIED = 304
_log = logging.getLogger(__name__)


class HttpPageFetcher(PageFetcher):
    """Follows redirects itself, so every hop (and the final host) is throttled and checked."""

    def __init__(self, polite: Politeness, cache: PageStore, reader: PageTextReader) -> None:
        self._polite = polite
        self._cache = cache
        self._reader = reader

    def fetch(self, url: str) -> Page:
        """A 304 or the same bytes keep the cached page (and its fetched_at and facts)."""
        stored = self._cache.get(url)
        try:
            response = self._response(url, stored)
        except FetchError as error:
            if stored is None:
                raise
            _log.warning("using the cached copy of %s: %s", url, error)
            return stored.page
        if stored is not None and self._unchanged(response, stored):
            return stored.page
        fresh = self._stored(url, response)
        self._cache.put(fresh, response.content)
        return fresh.page

    def _response(self, url: str, stored: StoredPage | None) -> httpx.Response:
        headers = stored.conditional_headers() if stored else {}
        try:
            response = self._follow(url, headers)
            if response.status_code != NOT_MODIFIED or stored is None:
                response.raise_for_status()
        except httpx.HTTPError as error:
            raise FetchError(f"{type(error).__name__}: {error}") from error
        return response

    def _unchanged(self, response: httpx.Response, stored: StoredPage) -> bool:
        if response.status_code == NOT_MODIFIED:
            return True
        return hashlib.sha256(response.content).hexdigest() == stored.page.sha256

    def _stored(self, url: str, response: httpx.Response) -> StoredPage:
        content_type = response.headers.get("content-type", "")
        text = self._reader.read(response.content, content_type, response.encoding or "utf-8")
        digest = hashlib.sha256(response.content).hexdigest()
        page = Page(url=url, text=text, sha256=digest, fetched_at=datetime.now(UTC))
        etag = response.headers.get("etag")
        return StoredPage(page, content_type, etag, response.headers.get("last-modified"))

    def _follow(self, url: str, headers: dict[str, str]) -> httpx.Response:
        target = url
        for _ in range(MAX_REDIRECTS + 1):
            response = self._polite.get(target, headers)
            # httpx counts 304 Not Modified as a redirect, but it has no location to follow.
            if not response.is_redirect or response.status_code == NOT_MODIFIED:
                return response
            target = str(response.url.join(response.headers["location"]))
        raise FetchError(f"more than {MAX_REDIRECTS} redirects from {url}")
