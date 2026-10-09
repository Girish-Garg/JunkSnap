"""The `yolo-export` step: a YOLO-format detector dataset; holdout rows are never written."""

from __future__ import annotations

import os
import shutil
from collections import Counter
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

from training.class_map import ClassMap
from training.domain import TRAINABLE_SPLITS, Box, ConfigError, ImageRecord, ManifestRow
from training.fetch import RecordFile
from training.ports import ObjectStore

EXPORT_SPLITS = (*TRAINABLE_SPLITS, "test")


@dataclass(frozen=True)
class BackgroundRule:
    """Rows without boxes that still teach the detector what is not waste or fire."""

    report_types: tuple[str, ...] = ("not_waste",)
    sources: tuple[str, ...] = ("dfire",)

    def applies(self, row: ManifestRow) -> bool:
        return row.report_type in self.report_types or row.source in self.sources


class YoloExporter:
    def __init__(self, cache: Path, class_map: ClassMap, store: ObjectStore) -> None:
        self._cache = cache
        self._class_map = class_map
        self._store = store
        self._names = class_map.vocabulary.yolo_classes
        self._background = BackgroundRule()

    def export(
        self, rows: list[ManifestRow], out: Path, extra: Mapping[str, tuple[Box, ...]] | None = None
    ) -> Counter[str]:
        """`extra` adds boxes per image id, for example a teacher model's boxes."""
        records = self._records({r.source for r in rows})
        counts: Counter[str] = Counter()
        lists: dict[str, list[str]] = {split: [] for split in EXPORT_SPLITS}
        for row in (r for r in rows if r.split in EXPORT_SPLITS):
            lines = self._lines(row, records.get(row.id), (extra or {}).get(row.id, ()))
            if not lines and not self._background.applies(row):
                continue
            lists[str(row.split)].append(self._write(row, lines, out))
            counts[str(row.split)] += 1
            counts["background"] += not lines
            counts.update(f"box:{self._names[int(line.split()[0])]}" for line in lines)
        self._write_lists(lists, out)
        return counts

    def _records(self, sources: set[str]) -> dict[str, ImageRecord]:
        found: dict[str, ImageRecord] = {}
        for source in sorted(sources):
            record_file = RecordFile(self._cache, source)
            record_file.pull(self._store)
            found.update((r.image_id, r) for r in record_file.read())
        return found

    def _local_image(self, row: ManifestRow) -> Path:
        """Downloads an image this machine never fetched; fails loudly when it cannot."""
        path = self._cache / str(row.local_path)
        if not path.exists():
            data = self._store.read(row.s3_key) if row.s3_key else None
            if data is None:
                raise ConfigError(f"image for {row.id} is neither in the cache nor in S3")
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        return path

    def _lines(
        self, row: ManifestRow, record: ImageRecord | None, extra: tuple[Box, ...]
    ) -> list[str]:
        if record is None and row.has_boxes:
            raise ConfigError(f"{row.id} is in the manifest but not in its records")
        lines = []
        for box in (*(record.boxes if record else ()), *extra):
            name = self._class_map.yolo_class(row.source, box.label)
            if name is not None:
                lines.append(box.yolo_line(self._names.index(name)))
        return lines

    def _write(self, row: ManifestRow, lines: list[str], out: Path) -> str:
        """Returns the image path relative to the export folder."""
        stem = row.id.replace("/", "__")
        image = f"images/{row.split}/{stem}.jpg"
        label = out / "labels" / str(row.split) / f"{stem}.txt"
        (out / image).parent.mkdir(parents=True, exist_ok=True)
        label.parent.mkdir(parents=True, exist_ok=True)
        self._link(self._local_image(row), out / image)
        label.write_text("".join(f"{line}\n" for line in lines), encoding="utf-8")
        return f"./{image}"

    @staticmethod
    def _link(src: Path, dest: Path) -> None:
        if dest.exists():
            return
        try:
            os.link(src, dest)
        except OSError:
            shutil.copyfile(src, dest)

    def _write_lists(self, lists: dict[str, list[str]], out: Path) -> None:
        out.mkdir(parents=True, exist_ok=True)
        for split, images in lists.items():
            (out / f"{split}.txt").write_text("".join(f"{p}\n" for p in images))
        names = "".join(f"  {i}: {name}\n" for i, name in enumerate(self._names))
        splits = "".join(f"{s}: {s}.txt\n" for s in EXPORT_SPLITS)
        text = f"path: {out.as_posix()}\n{splits}names:\n{names}"
        (out / "data.yaml").write_text(text, encoding="utf-8")
