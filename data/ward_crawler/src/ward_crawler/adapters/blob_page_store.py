"""Pages in the crawl cache: pages/<sha256>.json (text and headers), pages/<sha256>.bin, urls/."""

import hashlib
from datetime import UTC, datetime

from ward_crawler.adapters.json_blobs import JsonBlobs
from ward_crawler.adapters.page_codec import PageCodec
from ward_crawler.domain.stored_page import StoredPage
from ward_crawler.ports.page_store import PageStore


class BlobPageStore(PageStore):
    def __init__(self, blobs: JsonBlobs) -> None:
        self._blobs = blobs
        self._codec = PageCodec()

    def get(self, url: str) -> StoredPage | None:
        pointer = self._blobs.get(self._url_key(url))
        if not isinstance(pointer, dict) or "sha256" not in pointer:
            return None
        saved = self._blobs.get(f"pages/{pointer['sha256']}.json")
        try:
            return self._codec.from_json(saved)
        except (KeyError, TypeError, ValueError):
            return None

    def put(self, stored: StoredPage, content: bytes | None) -> None:
        """Bytes and text first, then the URL pointer, so a pointer never names a missing page."""
        page = stored.page
        if content is not None:
            kind = stored.content_type or "application/octet-stream"
            self._blobs.put_bytes(f"pages/{page.sha256}.bin", content, kind)
        self._blobs.put(f"pages/{page.sha256}.json", self._codec.to_json(stored))
        pointer = {
            "url": page.url,
            "sha256": page.sha256,
            "fetched_at": page.fetched_at.isoformat(),
            "checked_at": datetime.now(UTC).isoformat(),
            "etag": stored.etag,
            "last_modified": stored.last_modified,
        }
        self._blobs.put(self._url_key(page.url), pointer)

    def _url_key(self, url: str) -> str:
        return f"urls/{hashlib.sha256(url.encode()).hexdigest()[:24]}.json"
