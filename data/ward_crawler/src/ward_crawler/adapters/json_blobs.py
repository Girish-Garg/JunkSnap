"""JSON documents in a blob store; an entry that is not JSON reads as a miss."""

import json
from typing import Any

from ward_crawler.ports.blob_store import BlobStore

JSON_TYPE = "application/json"


class JsonBlobs:
    def __init__(self, blobs: BlobStore) -> None:
        self._blobs = blobs

    def get(self, key: str) -> Any:
        """None when the key is missing or does not hold JSON."""
        data = self._blobs.get(key)
        if data is None:
            return None
        try:
            return json.loads(data.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None

    def put(self, key: str, value: object) -> str:
        text = json.dumps(value, ensure_ascii=False, indent=1) + "\n"
        self._blobs.put(key, text.encode("utf-8"), JSON_TYPE)
        return self._blobs.where(key)

    def put_bytes(self, key: str, data: bytes, content_type: str) -> None:
        self._blobs.put(key, data, content_type)
