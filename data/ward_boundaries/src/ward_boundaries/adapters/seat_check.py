"""Cross-check: a ward must sit mostly inside the assembly seat an official list puts it in."""

import json
from dataclasses import replace
from pathlib import Path
from typing import Any

from shapely.geometry import shape

from ward_boundaries.adapters.shapely_ward_builder import WardShape

MIN_SHARE_INSIDE = 0.5


class SeatCheck:
    def __init__(self, seats_file: Path, ranges: list[list[Any]], source_url: str) -> None:
        features = json.loads(seats_file.read_text(encoding="utf-8"))["features"]
        self._seats = {f["properties"]["id"]: shape(f["geometry"]) for f in features}
        self._ranges = ranges
        self._source_url = source_url

    def apply(
        self, shapes: tuple[WardShape, ...]
    ) -> tuple[tuple[WardShape, ...], tuple[tuple[int, str], ...]]:
        kept: list[WardShape] = []
        dropped: list[tuple[int, str]] = []
        for ward_shape in shapes:
            seat_id = self._seat_for(ward_shape.evidence.number)
            if seat_id is None:
                kept.append(ward_shape)
                continue
            share = self._share_inside(ward_shape, seat_id)
            if share < MIN_SHARE_INSIDE:
                why = f"conflict: only {share:.0%} inside {seat_id}, its seat in {self._source_url}"
                dropped.append((ward_shape.evidence.number, why))
                continue
            kept.append(self._agreeing(ward_shape, seat_id, share))
        return tuple(kept), tuple(dropped)

    def _seat_for(self, number: int) -> str | None:
        return next((str(r[2]) for r in self._ranges if int(r[0]) <= number <= int(r[1])), None)

    def _share_inside(self, ward_shape: WardShape, seat_id: str) -> float:
        area = ward_shape.geometry.area
        inside = ward_shape.geometry.intersection(self._seats[seat_id]).area
        return float(inside / area) if area else 0.0

    def _agreeing(self, ward_shape: WardShape, seat_id: str, share: float) -> WardShape:
        note = f"{share:.0%} inside {seat_id}, its seat in the corporation's ward list"
        evidence = replace(
            ward_shape.evidence,
            notes=(*ward_shape.evidence.notes, note),
            seat_agrees=True,
        )
        return WardShape(evidence, ward_shape.geometry)
