"""The JSON form of a stored page, shared by the local cache and the S3 cache."""

from datetime import datetime
from typing import Any

from ward_crawler.domain.sources import Page
from ward_crawler.domain.stored_page import StoredPage


class PageCodec:
    def to_json(self, stored: StoredPage) -> dict[str, object]:
        page = stored.page
        return {
            "url": page.url,
            "fetched_at": page.fetched_at.isoformat(),
            "sha256": page.sha256,
            "content_type": stored.content_type,
            "etag": stored.etag,
            "last_modified": stored.last_modified,
            "text": page.text,
        }

    def from_json(self, saved: Any) -> StoredPage:
        """Raise KeyError, TypeError or ValueError for an entry that is not a page."""
        page = Page(
            url=saved["url"],
            text=saved["text"],
            sha256=saved["sha256"],
            fetched_at=datetime.fromisoformat(saved["fetched_at"]),
        )
        return StoredPage(
            page,
            str(saved.get("content_type") or ""),
            saved.get("etag"),
            saved.get("last_modified"),
        )
