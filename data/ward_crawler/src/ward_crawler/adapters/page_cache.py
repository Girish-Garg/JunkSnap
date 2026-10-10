"""Keeps fetched pages on disk (text, SHA-256, fetched_at): the dev fallback of the S3 cache."""

import hashlib
import json
import os
from pathlib import Path

from ward_crawler.adapters.page_codec import PageCodec
from ward_crawler.domain.stored_page import StoredPage
from ward_crawler.ports.page_store import PageStore


class PageCache(PageStore):
    def __init__(self, cache_dir: Path) -> None:
        self._cache_dir = cache_dir
        self._codec = PageCodec()

    def get(self, url: str) -> StoredPage | None:
        """A missing or unreadable cache entry is a miss, so the page is fetched again."""
        try:
            saved = json.loads(self._path(url).read_text(encoding="utf-8"))
            return self._codec.from_json(saved)
        except (OSError, ValueError, KeyError, TypeError):
            return None

    def put(self, stored: StoredPage, content: bytes | None = None) -> None:  # noqa: ARG002
        """Only the text is kept on disk; the raw bytes go to the S3 cache."""
        self._cache_dir.mkdir(parents=True, exist_ok=True)
        saved = self._codec.to_json(stored)
        path = self._path(stored.page.url)
        partial = path.with_suffix(".part")
        partial.write_text(json.dumps(saved, ensure_ascii=False), encoding="utf-8")
        os.replace(partial, path)

    def entries(self) -> tuple[StoredPage, ...]:
        """Every readable page in the folder, for seeding the S3 cache."""
        found = (self._read(path) for path in sorted(self._cache_dir.glob("*.json")))
        return tuple(page for page in found if page is not None)

    def _read(self, path: Path) -> StoredPage | None:
        try:
            return self._codec.from_json(json.loads(path.read_text(encoding="utf-8")))
        except (OSError, ValueError, KeyError, TypeError):
            return None

    def _path(self, url: str) -> Path:
        return self._cache_dir / f"{hashlib.sha256(url.encode()).hexdigest()[:24]}.json"
