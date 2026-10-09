"""The `fetch` step: download a source, normalise its images, write records, upload to S3."""

from __future__ import annotations

import json
import logging
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from training.domain import ConfigError, ExternalServiceError, ImageRecord
from training.images import ImageNormaliser
from training.ports import ObjectStore
from training.sources.base import DatasetSource, RawItem
from training.utils import s3_key

LOG = logging.getLogger(__name__)
UPLOAD_WORKERS = 16


class RecordFile:
    """`<cache>/<source>/records.jsonl`: one ImageRecord per line."""

    def __init__(self, cache: Path, source: str) -> None:
        self.path = cache / source / "records.jsonl"

    def write(self, records: list[ImageRecord]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        lines = (json.dumps(r.to_json(), sort_keys=True) for r in records)
        self.path.write_text("".join(f"{line}\n" for line in lines), encoding="utf-8")

    def read(self) -> list[ImageRecord]:
        if not self.path.exists():
            return []
        lines = self.path.read_text(encoding="utf-8").splitlines()
        return [ImageRecord.from_json(json.loads(line)) for line in lines if line]


class Fetcher:
    def __init__(self, cache: Path, store: ObjectStore, normaliser: ImageNormaliser) -> None:
        self._cache = cache
        self._store = store
        self._normaliser = normaliser

    def fetch(self, source: DatasetSource, limit: int | None) -> list[ImageRecord]:
        name = source.info.name
        source.download(self._cache, limit)
        records = [r for item in source.items(self._cache, limit) if (r := self._keep(name, item))]
        if len({r.image_id for r in records}) != len(records):
            raise ConfigError(f"{name}: two images map to one id")
        RecordFile(self._cache, name).write(records)
        self._upload(name, records)
        LOG.info("fetched %s: %d images", name, len(records))
        return records

    def _keep(self, name: str, item: RawItem) -> ImageRecord | None:
        relative = f"{name}/images/{item.stem}.jpg"
        dest = self._cache / relative
        if not dest.exists():
            try:
                self._normaliser.write(item.read(), dest)
            except ExternalServiceError as error:
                LOG.warning("skipped %s: %s", item.stem, error)
                return None
        return ImageRecord(f"{name}/{item.stem}", name, relative, item.labels, item.boxes)

    def _upload(self, name: str, records: list[ImageRecord]) -> None:
        done_file = self._cache / name / "uploaded.txt"
        done = set(done_file.read_text().split()) if done_file.exists() else set()
        todo = [r.path for r in records if r.path not in done]
        with ThreadPoolExecutor(UPLOAD_WORKERS) as pool:
            list(pool.map(lambda p: self._store.upload_file(self._cache / p, s3_key(p)), todo))
        records_file = RecordFile(self._cache, name).path
        self._store.upload_file(records_file, s3_key(f"{name}/records.jsonl"))
        if self._store.is_remote:
            done_file.write_text("\n".join(sorted(done | set(todo))))

