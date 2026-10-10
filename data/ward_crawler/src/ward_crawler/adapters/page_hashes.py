"""Remembers the hash of the page fetched for each URL in this run, for the extraction log."""

from ward_crawler.domain.sources import Page
from ward_crawler.ports.page_fetcher import PageFetcher


class PageHashes:
    def __init__(self) -> None:
        self._hashes: dict[str, str] = {}

    def note(self, page: Page) -> None:
        self._hashes[page.url] = page.sha256

    def sha_for(self, url: str) -> str | None:
        return self._hashes.get(url)


class RecordingPageFetcher(PageFetcher):
    def __init__(self, inner: PageFetcher, hashes: PageHashes) -> None:
        self._inner = inner
        self._hashes = hashes

    def fetch(self, url: str) -> Page:
        page = self._inner.fetch(url)
        self._hashes.note(page)
        return page
