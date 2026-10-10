from abc import ABC, abstractmethod

from ward_crawler.domain.stored_page import StoredPage


class PageStore(ABC):
    """The newest fetched copy of each URL."""

    @abstractmethod
    def get(self, url: str) -> StoredPage | None:
        """None when the URL was never stored or the copy is unreadable."""

    @abstractmethod
    def put(self, stored: StoredPage, content: bytes | None) -> None:
        """Keep the page; content is the raw fetched bytes when known."""
