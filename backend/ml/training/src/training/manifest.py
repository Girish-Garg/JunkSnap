"""The `build-manifest` step and the manifest file itself."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from training.class_map import ClassMap
from training.domain import TRAINABLE_SPLITS, ConfigError, ImageRecord, ManifestRow
from training.fetch import RecordFile
from training.ports import ObjectStore
from training.utils import count_values, s3_key

MAX_REPO_BYTES = 5_000_000
OPTIONAL_SOURCES = ("field",)
# The account id stays out of committed files.
PRIVATE_BUCKET = "s3://junksnap-<stage>-originals-<account_id>"


class ManifestBuilder:
    """Turns every source's records into manifest rows; splits are assigned later."""

    def __init__(self, cache: Path, class_map: ClassMap, licences: dict[str, str]) -> None:
        self._cache = cache
        self._class_map = class_map
        self._licences = licences

    def build(self, store: ObjectStore) -> list[ManifestRow]:
        """Refuses to build from a partial cache, so a rebuild never drops a source."""
        rows: list[ManifestRow] = []
        for source in sorted(self._licences):
            records = RecordFile(self._cache, source)
            if not records.pull(store) and source not in OPTIONAL_SOURCES:
                raise ConfigError(f"no records for {source} here or in S3: run fetch first")
            uploaded = records.uploaded()
            rows += [self._row(r, uploaded) for r in records.read()]
        return rows

    def _row(self, record: ImageRecord, uploaded: set[str]) -> ManifestRow:
        attrs = self._class_map.attributes_for(record)
        return ManifestRow(
            id=record.image_id,
            source=record.source,
            licence=self._licences[record.source],
            s3_key=s3_key(record.path) if record.path in uploaded else None,
            local_path=record.path,
            report_type=attrs.report_type,
            context=attrs.context,
            materials=attrs.materials,
            hazards=attrs.hazards,
            size_class=attrs.size_class,
            brands=attrs.brands,
            has_boxes=bool(record.boxes),
        )


class ManifestFile:
    """Working copy in the cache; the repo copy only while it stays small, else S3."""

    def __init__(self, cache: Path, repo_dir: Path, store: ObjectStore) -> None:
        self._work = cache / "manifest.jsonl"
        self._repo = repo_dir / "manifest.jsonl"
        self._summary = repo_dir / "manifest_summary.json"
        self._store = store

    def read(self) -> list[ManifestRow]:
        lines = self._text().splitlines()
        return [ManifestRow.from_json(json.loads(line)) for line in lines if line]

    def trainable(self) -> list[ManifestRow]:
        """The only rows training code may read: never test or the field holdout."""
        return [row for row in self.read() if row.split in TRAINABLE_SPLITS]

    def recorded_seed(self) -> int | None:
        if not self._summary.exists():
            return None
        seed = json.loads(self._summary.read_text(encoding="utf-8")).get("split_seed")
        return int(seed) if seed is not None else None

    def _text(self) -> str:
        for path in (self._work, self._repo):
            if path.exists():
                return path.read_text(encoding="utf-8")
        data = self._store.read(s3_key("manifest.jsonl"))
        if data is None:
            raise ConfigError("no manifest yet: run build-manifest")
        return data.decode("utf-8")

    def write(self, rows: list[ManifestRow], seed: int | None = None) -> dict[str, Any]:
        ordered = sorted(rows, key=lambda r: r.id)
        text = "".join(json.dumps(r.to_json(), sort_keys=True) + "\n" for r in ordered)
        self._work.parent.mkdir(parents=True, exist_ok=True)
        self._work.write_text(text, encoding="utf-8", newline="\n")
        location = self._publish(text)
        summary = ManifestSummary(ordered).as_json(location, seed)
        dumped = json.dumps(summary, indent=2) + "\n"
        self._summary.write_text(dumped, encoding="utf-8", newline="\n")
        return summary

    def _publish(self, text: str) -> str:
        if len(text.encode("utf-8")) <= MAX_REPO_BYTES:
            self._repo.write_text(text, encoding="utf-8", newline="\n")
            return "data/datasets/manifest.jsonl"
        if not self._store.is_remote:
            raise ConfigError("manifest is over 5 MB and --no-upload keeps it off S3")
        key = s3_key("manifest.jsonl")
        self._store.upload_file(self._work, key)
        self._repo.unlink(missing_ok=True)
        return f"{PRIVATE_BUCKET}/{key}"


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
            "by_source": count_values(r.source for r in rows),
            "by_licence": count_values(r.licence for r in rows),
            "by_split": count_values(r.split or "unassigned" for r in rows),
            "by_source_split": count_values(f"{r.source}/{r.split or 'unassigned'}" for r in rows),
            "by_report_type": count_values(r.report_type or "none" for r in rows),
            "by_material": count_values(m for r in rows for m in r.materials),
            "by_hazard": count_values(h for r in rows for h in r.hazards),
        }
