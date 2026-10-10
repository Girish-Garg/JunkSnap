"""Polite, cached fetching: text, SHA-256 and fetched_at of every page kept."""

import hashlib
import html
import json
import re
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path

import httpx
from pypdf import PdfReader

from ward_boundaries.adapters.politeness import Politeness
from ward_boundaries.domain.models import Document, WardBoundariesError

USER_AGENT = "JunkSnap-ward-boundaries/0.1 (civic waste reporting research)"


class CachedFetcher:
    def __init__(self, polite: Politeness, cache_dir: Path) -> None:
        self._polite = polite
        self._cache_dir = cache_dir

    def fetch(self, url: str) -> Document:
        path = self._cache_dir / f"{hashlib.sha256(url.encode()).hexdigest()[:24]}.json"
        if path.exists():
            saved = json.loads(path.read_text(encoding="utf-8"))
            return Document(
                url, saved["text"], saved["sha256"], datetime.fromisoformat(saved["at"])
            )
        document = self._download(url)
        self._cache_dir.mkdir(parents=True, exist_ok=True)
        saved = {
            "text": document.text,
            "sha256": document.sha256,
            "at": document.fetched_at.isoformat(),
        }
        path.write_text(json.dumps(saved, ensure_ascii=False), encoding="utf-8")
        return document

    def _download(self, url: str) -> Document:
        try:
            response = self._polite.get(url)
            response.raise_for_status()
        except httpx.HTTPError as error:
            raise WardBoundariesError(f"{url}: {error}") from error
        digest = hashlib.sha256(response.content).hexdigest()
        if response.content.startswith(b"%PDF"):
            text = self._pdf_text(response.content)
        else:
            text = self._text(response.text)
        return Document(url, text, digest, datetime.now(UTC))

    def _pdf_text(self, data: bytes) -> str:
        pages = PdfReader(BytesIO(data)).pages
        texts = (f"[page {n}]\n{page.extract_text() or ''}" for n, page in enumerate(pages, 1))
        return "\n".join(texts)

    def _text(self, page: str) -> str:
        page = re.sub(r"(?is)<(script|style)\b.*?</\1>", " ", page)
        text = html.unescape(re.sub(r"<[^>]+>", "\n", page))
        lines = (line.rstrip() for line in text.splitlines())
        return "\n".join(line for line in lines if line.strip())
