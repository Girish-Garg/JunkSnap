"""Keys as files under a local folder: the dev fallback of the S3 crawl cache."""

import os
from pathlib import Path

from ward_crawler.domain.errors import StoreError
from ward_crawler.ports.blob_store import BlobStore


class LocalBlobStore(BlobStore):
    def __init__(self, root: Path) -> None:
        self._root = root

    def get(self, key: str) -> bytes | None:
        try:
            return self._path(key).read_bytes()
        except FileNotFoundError:
            return None
        except OSError as error:
            raise StoreError(f"cannot read {self.where(key)}: {error}") from error

    def put(self, key: str, data: bytes, content_type: str) -> None:  # noqa: ARG002
        path = self._path(key)
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            partial = path.with_name(path.name + ".part")
            partial.write_bytes(data)
            os.replace(partial, path)
        except OSError as error:
            raise StoreError(f"cannot write {self.where(key)}: {error}") from error

    def where(self, key: str) -> str:
        return str(self._path(key))

    def _path(self, key: str) -> Path:
        path = (self._root / key).resolve()
        if not path.is_relative_to(self._root.resolve()):
            raise StoreError(f"key {key!r} leaves the cache folder")
        return path
