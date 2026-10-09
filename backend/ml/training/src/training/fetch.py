"""The `fetch` step: download a source, normalise its images, write records, upload to S3."""

from __future__ import annotations

import json
import logging
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from training.domain import ConfigError, ExternalServiceError, ImageRecord
from training.ports import ImageWriter, ObjectStore
from training.sources.base import DatasetSource, RawItem
from training.utils import s3_key

LOG = logging.getLogger(__name__)
UPLOAD_WORKERS = 16


class RecordFile:
    """`<cache>/<source>/records.jsonl` plus the list of image paths already in S3."""

    def __init__(self, cache: Path, source: str) -> None:
        self._source = source
        self._path = cache / source / "records.jsonl"
        self._uploaded = cache / source / "uploaded.txt"

    @property
    def path(self) -> Path:
        return self._path

    def write(self, records: list[ImageRecord]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        lines = (json.dumps(r.to_json(), sort_keys=True) for r in records)
        self._path.write_text("".join(f"{line}\n" for line in lines), encoding="utf-8")

    def read(self) -> list[ImageRecord]:
        if not self._path.exists():
            return []
        lines = self._path.read_text(encoding="utf-8").splitlines()
        return [ImageRecord.from_json(json.loads(line)) for line in lines if line]

    def pull(self, store: ObjectStore) -> bool:
        """Copies the records from S3 when this machine never fetched the source."""
        if self._path.exists():
            return True
        data = store.read(s3_key(f"{self._source}/records.jsonl"))
        if data is None:
            return False
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_bytes(data)
        self.mark_uploaded({r.path for r in self.read()})
        return True

    def uploaded(self) -> set[str]:
        return set(self._uploaded.read_text().split()) if self._uploaded.exists() else set()

    def mark_uploaded(self, paths: set[str]) -> None:
        self._uploaded.write_text("\n".join(sorted(self.uploaded() | paths)))


class Fetcher:
    def __init__(self, cache: Path, store: ObjectStore, images: ImageWriter) -> None:
        self._cache = cache
        self._store = store
        self._images = images

    def fetch(self, source: DatasetSource, limit: int | None) -> list[ImageRecord]:
        name = source.info.name
        source.download(self._cache, limit)
        items = source.items(self._cache, limit)
        records = [r for item in items if (r := self._keep(source, item))]
        if len({r.image_id for r in records}) != len(records):
            raise ConfigError(f"{name}: two images map to one id")
        RecordFile(self._cache, name).write(records)
        self._upload(name, records)
        LOG.info("fetched %s: %d images", name, len(records))
        return records

    def _keep(self, source: DatasetSource, item: RawItem) -> ImageRecord | None:
        name = source.info.name
        relative = f"{name}/images/{item.stem}.jpg"
        dest = self._cache / relative
        if not dest.exists():
            try:
                self._images.write(item.read(), dest)
            except ExternalServiceError as error:
                if not source.skips_unreadable:
                    raise
                LOG.warning("skipped %s: %s", item.stem, error)
                return None
        return ImageRecord(
            f"{name}/{item.stem}", name, relative, item.labels, item.boxes, item.attributes
        )

    def _upload(self, name: str, records: list[ImageRecord]) -> None:
        record_file = RecordFile(self._cache, name)
        done = record_file.uploaded()
        todo = [r.path for r in records if r.path not in done]
        with ThreadPoolExecutor(UPLOAD_WORKERS) as pool:
            list(pool.map(lambda p: self._store.upload_file(self._cache / p, s3_key(p)), todo))
        self._store.upload_file(record_file.path, s3_key(f"{name}/records.jsonl"))
        if self._store.is_remote:
            record_file.mark_uploaded(set(todo))
