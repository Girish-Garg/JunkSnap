"""Sources shipped as zip archives with COCO-style box annotations."""

from __future__ import annotations

import json
import posixpath
import zipfile
from collections import defaultdict
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import Any, override

from training.domain import Box
from training.ports import Downloader
from training.sources.base import DatasetSource, RawItem, SourceInfo
from training.utils import evenly_spaced, safe_stem, zip_reader


@dataclass(frozen=True)
class Archive:
    url: str
    filename: str


class CocoIndex:
    """Images and normalised boxes of one COCO annotation file."""

    def __init__(self, raw: dict[str, Any]) -> None:
        self._names = {c["id"]: c["name"] for c in raw["categories"]}
        self._images = {i["id"]: i for i in raw["images"]}
        self._boxes: dict[int, list[Box]] = defaultdict(list)
        for ann in raw["annotations"]:
            self._add(ann)

    def _add(self, ann: dict[str, Any]) -> None:
        image = self._images[ann["image_id"]]
        width, height = float(image["width"]), float(image["height"])
        x, y, w, h = ann["bbox"]
        box = Box(self._names[ann["category_id"]], x / width, y / height, w / width, h / height)
        clipped = box.clipped()
        if clipped is not None:
            self._boxes[ann["image_id"]].append(clipped)

    def entries(self) -> list[tuple[dict[str, Any], tuple[Box, ...]]]:
        return [(image, tuple(self._boxes[k])) for k, image in self._images.items()]


class CocoZipSource(DatasetSource):
    def __init__(self, info: SourceInfo, downloader: Downloader, archives: tuple[Archive, ...]):
        super().__init__(info, downloader)
        self._archives = archives

    @override
    def download(self, cache: Path, limit: int | None) -> None:
        for archive in self._archives:
            self.ensure_file(archive.url, self.raw_dir(cache) / archive.filename)

    def items(self, cache: Path, limit: int | None = None) -> Iterator[RawItem]:
        for archive in self._archives:
            with zipfile.ZipFile(self.raw_dir(cache) / archive.filename) as zf:
                prefix = archive.filename.rsplit(".", 1)[0]
                found = list(self._archive_items(zf, prefix))
                yield from evenly_spaced(found, self._share(limit))

    def _share(self, limit: int | None) -> int | None:
        return None if limit is None else max(1, limit // len(self._archives))

    def _archive_items(self, zf: zipfile.ZipFile, prefix: str) -> Iterator[RawItem]:
        names = set(zf.namelist())
        for json_name in sorted(n for n in names if self._is_annotation_file(n)):
            folder = posixpath.dirname(json_name)
            index = CocoIndex(json.loads(zf.read(json_name)))
            for image, boxes in index.entries():
                file_name = image["file_name"]
                member = posixpath.join(folder, file_name) if folder else file_name
                if member in names:
                    yield RawItem(
                        stem=safe_stem(f"{prefix}_{file_name}"),
                        read=zip_reader(zf, member),
                        boxes=boxes,
                    )

    @staticmethod
    def _is_annotation_file(name: str) -> bool:
        base = posixpath.basename(name)
        return base.endswith(".json") and "annotations" in base and "unofficial" not in base
