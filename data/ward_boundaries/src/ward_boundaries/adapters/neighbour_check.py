"""Cross-check: gazettes number wards in walking order, so ward n lies near wards n-3..n+3."""

import math
from dataclasses import replace

from ward_boundaries.adapters.shapely_ward_builder import WardShape

NEAR_KM = 3.0
FAR_KM = 4.0
SPAN = 3


class NeighbourCheck:
    def apply(self, shapes: tuple[WardShape, ...]) -> tuple[WardShape, ...]:
        middles = {s.evidence.number: s.geometry.centroid for s in shapes}
        return tuple(self._checked(s, middles) for s in shapes)

    def _checked(self, ward_shape: WardShape, middles: dict[int, object]) -> WardShape:
        number = ward_shape.evidence.number
        near = [m for m in middles if m != number and abs(m - number) <= SPAN]
        if not near:
            return ward_shape
        here = middles[number]
        km = min(self._km(here, middles[m]) for m in near)
        if km <= NEAR_KM:
            note, agrees = f"within {km:.1f} km of a ward numbered next to it", True
        elif km >= FAR_KM:
            note, agrees = f"{km:.1f} km from the nearest ward numbered next to it: check", False
        else:
            return ward_shape
        evidence = replace(
            ward_shape.evidence,
            notes=(*ward_shape.evidence.notes, note),
            layout_agrees=agrees,
        )
        return WardShape(evidence, ward_shape.geometry)

    def _km(self, a: object, b: object) -> float:
        ax, ay, bx, by = a.x, a.y, b.x, b.y  # type: ignore[attr-defined]
        return math.dist((ax * 100.0, ay * 111.0), (bx * 100.0, by * 111.0))
