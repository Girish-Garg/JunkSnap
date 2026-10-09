"""A fixed subset of the manifest, the same for every embedder, so benchmarks compare alike."""

from __future__ import annotations

from collections import defaultdict

from training.domain import ManifestRow
from training.utils import evenly_spaced

USED_SPLITS = ("train", "val", "test")


class BenchmarkSample:
    """Every row of train, val and test, or an evenly spaced cap per source and split."""

    def __init__(self, cap: int | None) -> None:
        self._cap = cap

    def rows(self, rows: list[ManifestRow]) -> list[ManifestRow]:
        groups: dict[tuple[str, str], list[ManifestRow]] = defaultdict(list)
        for row in sorted(rows, key=lambda r: r.id):
            if row.split in USED_SPLITS:
                groups[(row.source, str(row.split))].append(row)
        return [row for group in groups.values() for row in evenly_spaced(group, self._cap)]
