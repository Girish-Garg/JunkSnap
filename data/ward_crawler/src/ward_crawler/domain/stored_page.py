"""A cached page with what a conditional refetch needs (ETag, Last-Modified)."""

from dataclasses import dataclass

from ward_crawler.domain.sources import Page


@dataclass(frozen=True)
class StoredPage:
    page: Page
    content_type: str = ""
    etag: str | None = None
    last_modified: str | None = None

    def conditional_headers(self) -> dict[str, str]:
        headers: dict[str, str] = {}
        if self.etag:
            headers["If-None-Match"] = self.etag
        if self.last_modified:
            headers["If-Modified-Since"] = self.last_modified
        return headers
