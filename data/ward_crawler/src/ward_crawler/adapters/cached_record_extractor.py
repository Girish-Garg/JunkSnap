"""Reuses a stored extraction while the prompt, the model chain and the chunk are unchanged."""

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime

from ward_crawler.adapters.extraction_codec import ExtractionCodec
from ward_crawler.adapters.extraction_prompt import ExtractionPrompt
from ward_crawler.adapters.json_blobs import JsonBlobs
from ward_crawler.adapters.page_hashes import PageHashes
from ward_crawler.domain.extraction import Extraction, ExtractionRequest, ModelCall
from ward_crawler.domain.sources import MunicipalBody, Source
from ward_crawler.ports.record_extractor import RecordExtractor

# Raise when the stored form changes, so old entries miss.
CACHE_FORMAT = 1


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class CacheVersion:
    """The prompt version and the model chain an extraction depends on."""

    prompt: str
    models: tuple[str, ...]

    @staticmethod
    def of(prompt: ExtractionPrompt, models: tuple[str, ...]) -> "CacheVersion":
        """Hashes the system prompt and the user and repair templates, so any edit misses."""
        probe = ExtractionRequest(
            "city", (MunicipalBody("body", "Body"),), Source("u", "h", None), "t"
        )
        rendered = prompt.system() + prompt.user(probe) + prompt.repair("problem")
        return CacheVersion(_sha(rendered)[:16], models)


class CachedRecordExtractor(RecordExtractor):
    """Failed extractions are not stored, so the next run asks the models again."""

    def __init__(
        self, inner: RecordExtractor, blobs: JsonBlobs, version: CacheVersion, hashes: PageHashes
    ) -> None:
        self._inner = inner
        self._blobs = blobs
        self._version = version
        self._hashes = hashes
        self._codec = ExtractionCodec()
        self._hits = 0

    def extract(self, request: ExtractionRequest) -> Extraction:
        key = self._key(request)
        cached = self._read(key)
        if cached is not None:
            self._hits += 1
            return cached
        extraction = self._inner.extract(request)
        self._blobs.put(f"extractions/{key}.json", self._entry(key, request, extraction))
        return extraction

    def usage(self) -> tuple[ModelCall, ...]:
        return self._inner.usage()

    def hits(self) -> int:
        return self._hits

    def _read(self, key: str) -> Extraction | None:
        saved = self._blobs.get(f"extractions/{key}.json")
        if saved is None:
            return None
        try:
            return self._codec.from_json(saved)
        except (KeyError, TypeError, ValueError):
            return None

    def _key(self, request: ExtractionRequest) -> str:
        source = request.source
        material = {
            "format": CACHE_FORMAT,
            "prompt": self._version.prompt,
            "models": list(self._version.models),
            "city": request.city,
            "bodies": [[body.slug, body.name] for body in request.bodies],
            "source": [source.url, source.holds, source.body, list(source.fields)],
            "chunk": _sha(request.text),
        }
        return _sha(json.dumps(material, sort_keys=True, ensure_ascii=False))

    def _entry(self, key: str, request: ExtractionRequest, extraction: Extraction) -> object:
        return {
            "key": key,
            "prompt_version": self._version.prompt,
            "models": list(self._version.models),
            "source_url": request.source.url,
            "page_sha256": self._hashes.sha_for(request.source.url),
            "chunk_sha256": _sha(request.text),
            "created_at": datetime.now(UTC).isoformat(),
            **self._codec.to_json(extraction),
        }
