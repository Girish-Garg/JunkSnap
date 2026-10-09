"""The `split` step: a fixed train / val / test / holdout assignment from a seed."""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass

from training.domain import ManifestRow

FIELD_SOURCE = "field"
DEFAULT_SEED = 26
ROBOFLOW_COPY = re.compile(r"_(jpg|jpeg|png)_rf_[0-9a-f]+$")


@dataclass(frozen=True)
class SplitRatios:
    """Upper bounds of each split on a 0..1 hash scale, checked in order."""

    first: tuple[str, float]
    second: tuple[str, float]
    rest: str


PUBLIC = SplitRatios(("test", 0.10), ("val", 0.20), "train")
FIELD = SplitRatios(("holdout", 0.30), ("val", 0.40), "train")


class Splitter:
    """Hash-based, so adding images never moves an earlier image to another split."""

    def __init__(self, seed: int = DEFAULT_SEED) -> None:
        self._seed = seed

    @property
    def seed(self) -> int:
        return self._seed

    def assign(self, rows: list[ManifestRow]) -> list[ManifestRow]:
        return [row.with_split(self.split_of(row)) for row in rows]

    def split_of(self, row: ManifestRow) -> str:
        ratios = FIELD if row.source == FIELD_SOURCE else PUBLIC
        point = self._point(self._group(row.id))
        for name, bound in (ratios.first, ratios.second):
            if point < bound:
                return name
        return ratios.rest

    def _point(self, key: str) -> float:
        digest = hashlib.sha256(f"{self._seed}:{key}".encode()).hexdigest()
        return int(digest[:13], 16) / 16**13

    @staticmethod
    def _group(image_id: str) -> str:
        """Roboflow augmentation copies of one photo share a split, so they cannot leak."""
        return ROBOFLOW_COPY.sub("", image_id)
