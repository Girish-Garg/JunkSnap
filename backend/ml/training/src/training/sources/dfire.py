"""D-Fire fire and smoke images (CC0), read from a public Hugging Face mirror file by file."""

from __future__ import annotations

from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from training.domain import Box
from training.sources.base import DatasetSource, RawItem
from training.utils import evenly_spaced

MIRROR = "https://huggingface.co/datasets/badsaarow/d-fire"
CLASS_NAMES = ("smoke", "fire")
WORKERS = 8
YOLO_FIELDS = 5


class DFireSource(DatasetSource):
    def download(self, cache: Path, limit: int | None) -> None:
        listing = self._downloader.get_json(MIRROR.replace("/datasets/", "/api/datasets/"))
        names = sorted(s["rfilename"] for s in listing["siblings"])
        labelled = {Path(n).stem for n in names if n.startswith("train/labels/")}
        images = [n for n in names if n.startswith("train/images/") and Path(n).stem in labelled]
        chosen = evenly_spaced(images, limit)
        with ThreadPoolExecutor(WORKERS) as pool:
            list(pool.map(lambda name: self._fetch_pair(cache, name), chosen))

    def _fetch_pair(self, cache: Path, image_name: str) -> None:
        stem = Path(image_name).stem
        label_name = f"train/labels/{stem}.txt"
        self.ensure_file(f"{MIRROR}/resolve/main/{label_name}", self._label_path(cache, stem))
        image = self._image_dir(cache) / f"{stem}.jpg"
        self.ensure_file(f"{MIRROR}/resolve/main/{image_name}", image)

    def items(self, cache: Path, limit: int | None = None) -> Iterator[RawItem]:
        images = sorted(self._image_dir(cache).glob("*.jpg"))
        for image in evenly_spaced(images, limit):
            boxes = self._boxes(self._label_path(cache, image.stem))
            yield RawItem(
                stem=f"dfire_{image.stem.lower()}",
                read=image.read_bytes,
                labels=() if boxes else ("none",),
                boxes=boxes,
            )

    def _image_dir(self, cache: Path) -> Path:
        return self.raw_dir(cache) / "images"

    def _label_path(self, cache: Path, stem: str) -> Path:
        return self.raw_dir(cache) / "labels" / f"{stem}.txt"

    @staticmethod
    def _boxes(label_file: Path) -> tuple[Box, ...]:
        if not label_file.exists():
            return ()
        boxes = []
        for line in label_file.read_text(encoding="utf-8").split("\n"):
            parts = line.split()
            if len(parts) == YOLO_FIELDS:
                index, cx, cy, w, h = int(parts[0]), *map(float, parts[1:])
                box = Box(CLASS_NAMES[index], cx - w / 2, cy - h / 2, w, h).clipped()
                boxes.extend([box] if box else [])
        return tuple(boxes)
