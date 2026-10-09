"""Keeps fetched pages on disk (text, SHA-256, fetched_at) so reruns do not refetch."""

import hashlib
import json
import os
from datetime import datetime
from pathlib import Path

from ward_crawler.domain.sources import Page


class PageCache:
    def __init__(self, cache_dir: Path) -> None:
        self._cache_dir = cache_dir

    def get(self, url: str) -> Page | None:
        """A missing or unreadable cache entry is a miss, so the page is fetched again."""
        try:
            saved = json.loads(self._path(url).read_text(encoding="utf-8"))
            return Page(
                url=saved["url"],
                text=saved["text"],
                sha256=saved["sha256"],
                fetched_at=datetime.fromisoformat(saved["fetched_at"]),
            )
        except (OSError, ValueError, KeyError, TypeError):
            return None

    def put(self, page: Page) -> None:
        self._cache_dir.mkdir(parents=True, exist_ok=True)
        saved = {
            "url": page.url,
            "fetched_at": page.fetched_at.isoformat(),
            "sha256": page.sha256,
            "text": page.text,
        }
        path = self._path(page.url)
        partial = path.with_suffix(".part")
        partial.write_text(json.dumps(saved, ensure_ascii=False), encoding="utf-8")
        os.replace(partial, path)

    def _path(self, url: str) -> Path:
        return self._cache_dir / f"{hashlib.sha256(url.encode()).hexdigest()[:24]}.json"
