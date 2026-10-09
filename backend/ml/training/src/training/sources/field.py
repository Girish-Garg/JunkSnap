"""Field-audit photos from a Label Studio export: blurred copies only, merged by image id."""

from __future__ import annotations

import re
import urllib.parse
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import override

from training.domain import ConfigError, ImageRecord
from training.ports import Downloader, ObjectStore
from training.sources.base import DatasetSource, RawItem, SourceInfo
from training.utils import s3_key

BLURRED = re.compile(r"^/?media/(reports|cleanups)/[^/]+\.jpe?g$")


@dataclass(frozen=True)
class FieldPhotos:
    """Reads the pipeline's blurred copies (`media/reports/...`) from S3 or CloudFront."""

    store: ObjectStore
    web: Downloader

    def read(self, ref: str) -> bytes:
        parsed = urllib.parse.urlparse(ref)
        path = parsed.path if parsed.scheme in ("https", "http") else parsed.path.lstrip("/")
        if parsed.scheme not in ("s3", "https", "http") or not BLURRED.match(path):
            raise ConfigError(f"{ref}: only blurred copies under media/reports/ are accepted")
        data = self.store.read(ref) if parsed.scheme == "s3" else self.web.fetch(ref)
        if data is None:
            raise ConfigError(f"field photo missing: {ref}")
        return data

    def stored(self, record: ImageRecord) -> bytes:
        """A photo an earlier import already copied to `datasets/field/`."""
        data = self.store.read(s3_key(record.path))
        if data is None:
            raise ConfigError(f"recorded field photo missing in S3: {record.path}")
        return data


class FieldRecordMerge:
    """Which recorded photos survive a new export; a partial export never drops data silently."""

    MODES = ("strict", "keep-missing", "replace")

    def __init__(self, mode: str) -> None:
        if mode not in self.MODES:
            raise ConfigError(f"unknown merge mode {mode}")
        self._mode = mode

    def kept(self, recorded: list[ImageRecord], labelled: list[ImageRecord]) -> list[ImageRecord]:
        exported = {r.image_id for r in labelled}
        missing = [r for r in recorded if r.image_id not in exported]
        if missing and self._mode == "strict":
            ids = ", ".join(r.image_id for r in missing[:3])
            raise ConfigError(
                f"export drops {len(missing)} recorded photos ({ids}); "
                "pass --keep-missing to keep them or --replace to drop them"
            )
        return missing if self._mode == "keep-missing" else []


class FieldExportSource(DatasetSource):
    skips_unreadable = False

    def __init__(
        self, info: SourceInfo, labelled: list[ImageRecord], kept: list[ImageRecord],
        photos: FieldPhotos,
    ) -> None:
        super().__init__(info, photos.web)
        self._labelled = labelled
        self._kept = kept
        self._photos = photos

    @override
    def image_path(self, stem: str) -> str:
        """Contract layout: `datasets/field/{report_id}.jpg`."""
        return f"{self.info.name}/{stem}.jpg"

    @override
    def download(self, cache: Path, limit: int | None) -> None:
        return None

    @override
    def items(self, cache: Path, limit: int | None = None) -> Iterator[RawItem]:
        for record in self._labelled:
            yield self._item(record, self._from_export(record.path))
        for record in self._kept:
            yield self._item(record, self._from_store(record))

    @staticmethod
    def _item(record: ImageRecord, read: Callable[[], bytes]) -> RawItem:
        stem = record.image_id.split("/", 1)[1]
        return RawItem(stem=stem, read=read, boxes=record.boxes, attributes=record.attributes)

    def _from_export(self, ref: str) -> Callable[[], bytes]:
        return lambda: self._photos.read(ref)

    def _from_store(self, record: ImageRecord) -> Callable[[], bytes]:
        return lambda: self._photos.stored(record)
