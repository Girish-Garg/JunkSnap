"""Labelled photos for the ml scoring CLI: report-type photos plus a fixed set of fire photos."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from training.domain import ConfigError, ManifestRow
from training.utils import evenly_spaced

TYPE_LABELS = ("waste_dump", "not_waste")


class CaseWriter:
    """One JSON line per photo: id, absolute path and the truth the scores are checked against."""

    def __init__(self, cache: Path, type_sources: tuple[str, ...], fire_photos: int) -> None:
        self._cache = cache
        self._type_sources = type_sources
        self._fire_photos = fire_photos

    def write(self, rows: list[ManifestRow], split: str, out: Path) -> int:
        if split == "holdout" or split not in ("val", "test"):
            raise ConfigError("cases come from val or test; the field holdout has its own run")
        chosen = self._typed(rows, split) + self._fire(rows, split)
        out.parent.mkdir(parents=True, exist_ok=True)
        lines = [json.dumps(self._case(row)) for row in chosen]
        out.write_text("".join(f"{line}\n" for line in lines), encoding="utf-8")
        return len(chosen)

    def _typed(self, rows: list[ManifestRow], split: str) -> list[ManifestRow]:
        return sorted(
            (r for r in rows if r.split == split and r.source in self._type_sources
             and r.report_type in TYPE_LABELS),
            key=lambda r: r.id,
        )

    def _fire(self, rows: list[ManifestRow], split: str) -> list[ManifestRow]:
        fire = sorted((r for r in rows if r.split == split and r.source == "dfire"),
                      key=lambda r: r.id)
        half = self._fire_photos // 2
        if half == 0:
            return []
        burning = [r for r in fire if "burning" in r.hazards]
        clear = [r for r in fire if "burning" not in r.hazards]
        return evenly_spaced(burning, half) + evenly_spaced(clear, half)

    def _case(self, row: ManifestRow) -> dict[str, Any]:
        waste = None if row.report_type not in TYPE_LABELS else row.report_type == "waste_dump"
        return {
            "id": row.id,
            "path": str((self._cache / str(row.local_path)).resolve()),
            "truth": {"source": row.source, "waste": waste, "burning": "burning" in row.hazards},
        }
