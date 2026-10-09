"""The `yolo-export` step: a YOLO-format detector dataset; holdout rows are never written."""

from __future__ import annotations

import os
import shutil
from collections import Counter
from pathlib import Path

from training.class_map import ClassMap
from training.domain import ImageRecord, ManifestRow
from training.fetch import RecordFile

EXPORT_SPLITS = ("train", "val", "test")


class YoloExporter:
    def __init__(self, cache: Path, class_map: ClassMap, out_dir: Path) -> None:
        self._cache = cache
        self._class_map = class_map
        self._out = out_dir
        self._names = class_map.vocabulary.yolo_classes

    def export(self, rows: list[ManifestRow]) -> Counter[str]:
        records = self._records({r.source for r in rows})
        counts: Counter[str] = Counter()
        lists: dict[str, list[str]] = {split: [] for split in EXPORT_SPLITS}
        for row in rows:
            record = records.get(row.id)
            if row.split not in EXPORT_SPLITS or record is None or row.local_path is None:
                continue
            lines = self._lines(record)
            if lines:
                lists[str(row.split)].append(self._write(row, lines))
                counts[row.split] += 1
                counts.update(f"box:{self._names[int(line.split()[0])]}" for line in lines)
        self._write_lists(lists)
        return counts

    def _records(self, sources: set[str]) -> dict[str, ImageRecord]:
        return {
            r.image_id: r
            for source in sorted(sources)
            for r in RecordFile(self._cache, source).read()
        }

    def _lines(self, record: ImageRecord) -> list[str]:
        lines = []
        for box in record.boxes:
            name = self._class_map.yolo_class(record.source, box.label)
            if name is not None:
                lines.append(box.yolo_line(self._names.index(name)))
        return lines

    def _write(self, row: ManifestRow, lines: list[str]) -> str:
        """Returns the image path relative to the export folder."""
        stem = row.id.replace("/", "__")
        image = f"images/{row.split}/{stem}.jpg"
        label = self._out / "labels" / str(row.split) / f"{stem}.txt"
        (self._out / image).parent.mkdir(parents=True, exist_ok=True)
        label.parent.mkdir(parents=True, exist_ok=True)
        self._link(self._cache / str(row.local_path), self._out / image)
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

    def _write_lists(self, lists: dict[str, list[str]]) -> None:
        self._out.mkdir(parents=True, exist_ok=True)
        for split, images in lists.items():
            (self._out / f"{split}.txt").write_text("".join(f"{p}\n" for p in images))
        names = "".join(f"  {i}: {name}\n" for i, name in enumerate(self._names))
        splits = "".join(f"{s}: {s}.txt\n" for s in EXPORT_SPLITS)
        text = f"path: {self._out.as_posix()}\n{splits}names:\n{names}"
        (self._out / "data.yaml").write_text(text, encoding="utf-8")
