"""Field-audit photos from a Label Studio export, read from S3 or a local photo folder."""

from __future__ import annotations

from collections.abc import Callable, Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import override

from training.domain import ConfigError, ImageRecord
from training.ports import Downloader, ObjectStore
from training.sources.base import DatasetSource, RawItem, SourceInfo


@dataclass(frozen=True)
class FieldPhotos:
    """Where the export's photos are: `s3://` tasks read from S3, others from `folder`."""

    store: ObjectStore
    folder: Path | None

    def read(self, ref: str) -> bytes:
        if ref.startswith("s3://"):
            data = self.store.read(ref)
            if data is None:
                raise ConfigError(f"field photo missing in S3: {ref}")
            return data
        if self.folder is None or not (self.folder / ref).exists():
            raise ConfigError(f"field photo {ref} not found; pass --photos <folder>")
        return (self.folder / ref).read_bytes()


class FieldExportSource(DatasetSource):
    skips_unreadable = False

    def __init__(
        self, info: SourceInfo, downloader: Downloader, labelled: list[ImageRecord],
        photos: FieldPhotos,
    ) -> None:
        super().__init__(info, downloader)
        self._labelled = labelled
        self._photos = photos

    @override
    def download(self, cache: Path, limit: int | None) -> None:
        return None

    @override
    def items(self, cache: Path, limit: int | None = None) -> Iterator[RawItem]:
        for record in self._labelled:
            yield RawItem(
                stem=record.image_id.split("/", 1)[1],
                read=self._reader(record.path),
                boxes=record.boxes,
                attributes=record.attributes,
            )

    def _reader(self, ref: str) -> Callable[[], bytes]:
        return lambda: self._photos.read(ref)
