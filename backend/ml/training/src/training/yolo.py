"""The `yolo-export` step: a YOLO-format detector dataset; holdout rows are never written."""

from __future__ import annotations

import os
import shutil
from collections import Counter
from pathlib import Path

from training.class_map import ClassMap
from training.domain import TRAINABLE_SPLITS, ConfigError, ImageRecord, ManifestRow
from training.fetch import RecordFile
from training.ports import ObjectStore

EXPORT_SPLITS = (*TRAINABLE_SPLITS, "test")


class YoloExporter:
    def __init__(self, cache: Path, class_map: ClassMap, store: ObjectStore) -> None:
        self._cache = cache
        self._class_map = class_map
        self._store = store
        self._names = class_map.vocabulary.yolo_classes

    def export(self, rows: list[ManifestRow], out: Path) -> Counter[str]:
        records = self._records({r.source for r in rows})
        counts: Counter[str] = Counter()
        lists: dict[str, list[str]] = {split: [] for split in EXPORT_SPLITS}
        for row in (r for r in rows if r.split in EXPORT_SPLITS and r.has_boxes):
            if row.id not in records:
                raise ConfigError(f"{row.id} is in the manifest but not in its records")
            lines = self._lines(records[row.id])
            if lines:
                lists[str(row.split)].append(self._write(row, lines, out))
                counts[str(row.split)] += 1
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

    def _lines(self, record: ImageRecord) -> list[str]:
        lines = []
        for box in record.boxes:
            name = self._class_map.yolo_class(record.source, box.label)
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
        label.write_text("\n".join(lines) + "\n", encoding="utf-8")
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
