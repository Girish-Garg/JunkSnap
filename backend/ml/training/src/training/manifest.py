"""The `build-manifest` step and the manifest file itself."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

from training.class_map import ClassMap
from training.domain import ImageRecord, ManifestRow
from training.fetch import RecordFile
from training.ports import ObjectStore
from training.utils import s3_key

MAX_REPO_BYTES = 5_000_000
# The account id stays out of committed files.
PRIVATE_BUCKET = "s3://junksnap-<stage>-originals-<account_id>"


class ManifestBuilder:
    """Turns every source's records into manifest rows; splits are assigned later."""

    def __init__(self, cache: Path, class_map: ClassMap, licences: dict[str, str]) -> None:
        self._cache = cache
        self._class_map = class_map
        self._licences = licences

    def build(self) -> list[ManifestRow]:
        rows: list[ManifestRow] = []
        for source in sorted(self._licences):
            uploaded = self._uploaded(source)
            rows += [self._row(r, uploaded) for r in RecordFile(self._cache, source).read()]
        return rows

    def _uploaded(self, source: str) -> set[str]:
        done = self._cache / source / "uploaded.txt"
        return set(done.read_text().split()) if done.exists() else set()

    def _row(self, record: ImageRecord, uploaded: set[str]) -> ManifestRow:
        attrs = self._class_map.attributes_for(record)
        remote, local = self._locate(record, uploaded)
        return ManifestRow(
            id=record.image_id,
            source=record.source,
            licence=self._licences[record.source],
            s3_key=remote,
            local_path=local,
            report_type=attrs.report_type,
            context=attrs.context,
            materials=attrs.materials,
            hazards=attrs.hazards,
            size_class=attrs.size_class,
            brands=attrs.brands,
            has_boxes=bool(record.boxes),
        )

    @staticmethod
    def _locate(record: ImageRecord, uploaded: set[str]) -> tuple[str | None, str | None]:
        if record.path.startswith("s3://"):
            return record.path.split("/", 3)[3], None
        return (s3_key(record.path) if record.path in uploaded else None), record.path


class ManifestFile:
    """Working copy in the cache; the repo copy only while it stays small, else S3."""

    def __init__(self, cache: Path, repo_dir: Path, store: ObjectStore) -> None:
        self._work = cache / "manifest.jsonl"
        self._repo = repo_dir / "manifest.jsonl"
        self._summary = repo_dir / "manifest_summary.json"
        self._store = store

    def read(self) -> list[ManifestRow]:
        path = self._work if self._work.exists() else self._repo
        lines = path.read_text(encoding="utf-8").splitlines()
        return [ManifestRow.from_json(json.loads(line)) for line in lines if line]

    def write(self, rows: list[ManifestRow], seed: int | None = None) -> dict[str, Any]:
        ordered = sorted(rows, key=lambda r: r.id)
        text = "".join(json.dumps(r.to_json(), sort_keys=True) + "\n" for r in ordered)
        self._work.parent.mkdir(parents=True, exist_ok=True)
        self._work.write_text(text, encoding="utf-8")
        location = self._publish(text)
        summary = ManifestSummary(ordered).as_json(location, seed)
        self._summary.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
        return summary

    def _publish(self, text: str) -> str:
        if len(text.encode("utf-8")) <= MAX_REPO_BYTES:
            self._repo.write_text(text, encoding="utf-8")
            return "data/datasets/manifest.jsonl"
        self._repo.unlink(missing_ok=True)
        key = s3_key("manifest.jsonl")
        self._store.upload_file(self._work, key)
        return f"{PRIVATE_BUCKET}/{key}" if self._store.is_remote else str(self._work)


class ManifestSummary:
    def __init__(self, rows: list[ManifestRow]) -> None:
        self._rows = rows

    def as_json(self, location: str, seed: int | None) -> dict[str, Any]:
        rows = self._rows
        return {
            "manifest": location,
            "split_seed": seed,
            "images": len(rows),
            "with_boxes": sum(r.has_boxes for r in rows),
            "by_source": _count(r.source for r in rows),
            "by_licence": _count(r.licence for r in rows),
            "by_split": _count(r.split or "unassigned" for r in rows),
            "by_source_split": _count(f"{r.source}/{r.split or 'unassigned'}" for r in rows),
            "by_report_type": _count(r.report_type or "none" for r in rows),
            "by_material": _count(m for r in rows for m in r.materials),
            "by_hazard": _count(h for r in rows for h in r.hazards),
        }


def _count(values: Any) -> dict[str, int]:
    return dict(sorted(Counter(values).items()))
