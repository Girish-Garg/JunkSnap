"""TACO: GitHub annotations plus the 640 px Flickr copies the TACO download script also uses."""

from __future__ import annotations

import json
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, override

from training.domain import Box
from training.sources.base import DatasetSource, RawItem
from training.sources.coco import CocoIndex
from training.utils import evenly_spaced, safe_stem

ANNOTATIONS = "https://raw.githubusercontent.com/pedropro/TACO/master/data/annotations.json"
WORKERS = 8


class TacoSource(DatasetSource):
    """Skips the OpenLitterMap batches: they are ODbL, not CC BY, and have no Flickr copy."""

    def download(self, cache: Path, limit: int | None) -> None:
        index = self._index(cache)
        chosen = evenly_spaced([image for image, _ in self._usable(index)], limit)
        with ThreadPoolExecutor(WORKERS) as pool:
            list(pool.map(lambda image: self._fetch(cache, image), chosen))

    @override
    def items(self, cache: Path, limit: int | None = None) -> Iterator[RawItem]:
        for image, boxes in self._usable(self._index(cache)):
            path = self._image_path(cache, image)
            if path.exists():
                yield RawItem(stem=path.stem, read=path.read_bytes, boxes=boxes)

    def _index(self, cache: Path) -> CocoIndex:
        path = self.ensure_file(ANNOTATIONS, self.raw_dir(cache) / "annotations.json")
        return CocoIndex(json.loads(path.read_text(encoding="utf-8")))

    @staticmethod
    def _usable(index: CocoIndex) -> list[tuple[dict[str, Any], tuple[Box, ...]]]:
        return [
            (image, boxes) for image, boxes in index.entries()
            if image.get("flickr_640_url") and "ODBL" not in str(image.get("license")).upper()
        ]

    def _fetch(self, cache: Path, image: dict[str, Any]) -> None:
        self.ensure_file(image["flickr_640_url"], self._image_path(cache, image))

    def _image_path(self, cache: Path, image: dict[str, Any]) -> Path:
        return self.raw_dir(cache) / "images" / f"taco_{safe_stem(image['file_name'])}.jpg"
