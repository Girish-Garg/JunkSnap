from abc import ABC, abstractmethod

from ward_crawler.domain.sources import Page


class PageFetcher(ABC):
    """Fetches one URL and returns its text with the hash of the fetched bytes."""

    @abstractmethod
    def fetch(self, url: str) -> Page:
        """Raise FetchError when the page cannot be fetched or read."""
