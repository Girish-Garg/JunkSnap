"""Ward polygons: Voronoi cells of each ward's own places, kept within a short reach of them."""

import math
from dataclasses import dataclass
from typing import Any

import shapely
from shapely import MultiPoint, Point
from shapely.ops import unary_union, voronoi_diagram

from ward_boundaries.domain.models import WardEvidence

MIN_PLACES = 1
EARTH_M_PER_DEG = 111_320.0
Spot = tuple[tuple[float, float], str]


@dataclass(frozen=True)
class WardShape:
    evidence: WardEvidence
    geometry: Any


class ShapelyWardBuilder:
    """Space goes to the nearest listed place; a ward never reaches past `reach_m` from them."""

    def __init__(self, origin: tuple[float, float], reach_m: float = 600.0) -> None:
        self._lat0, self._lon0 = origin
        self._reach_m = reach_m
        self._kx = EARTH_M_PER_DEG * math.cos(math.radians(self._lat0))

    def build(
        self, wards: tuple[WardEvidence, ...]
    ) -> tuple[tuple[WardShape, ...], tuple[tuple[int, str], ...]]:
        cores = {ward.number: self._core(ward) for ward in wards}
        usable = [ward for ward in wards if self._localities(cores[ward.number]) >= MIN_PLACES]
        left_out = [(ward.number, self._why(ward, cores)) for ward in wards if ward not in usable]
        points = self._points(usable, cores)
        if not points:
            return (), tuple(left_out)
        cells = self._cells(points)
        shapes = [WardShape(ward, self._shape(ward.number, points, cells)) for ward in usable]
        empty = [s.evidence.number for s in shapes if s.geometry.is_empty]
        left_out += [(number, "every place shared a spot with another ward") for number in empty]
        return tuple(s for s in shapes if not s.geometry.is_empty), tuple(sorted(left_out))

    def _why(self, ward: WardEvidence, cores: dict[int, list[Spot]]) -> str:
        found, kept = ward.places_found(), self._localities(cores[ward.number])
        return f"{found} listed localities found on the map, {kept} of them close together"

    def _localities(self, core: list[Spot]) -> int:
        return len({listed for _, listed in core})

    def _points(
        self, wards: list[WardEvidence], cores: dict[int, list[Spot]]
    ) -> list[tuple[Point, int]]:
        seen: dict[tuple[float, float], int] = {}
        for ward in wards:
            for xy, _ in cores[ward.number]:
                seen.setdefault(xy, ward.number)
        return [(Point(xy), number) for xy, number in seen.items()]

    def _core(self, ward: WardEvidence) -> list[Spot]:
        """A ward is compact: places far from the ward's middle place are likely mismatches."""
        spots = list(dict.fromkeys((self._xy(p.lat, p.lon), listed) for listed, p in ward.matched))
        if not spots:
            return []
        middle = min(spots, key=lambda a: sum(math.dist(a[0], b[0]) for b in spots))[0]
        return [spot for spot in spots if math.dist(spot[0], middle) <= self._reach_m * 2.5]

    def _cells(self, points: list[tuple[Point, int]]) -> list[tuple[Any, int]]:
        sites = MultiPoint([point for point, _ in points])
        envelope = sites.envelope.buffer(self._reach_m * 4)
        owned = []
        for cell in voronoi_diagram(sites, envelope=envelope).geoms:
            owner = next((number for point, number in points if cell.covers(point)), None)
            if owner is not None:
                owned.append((cell, owner))
        return owned

    def _shape(
        self, number: int, points: list[tuple[Point, int]], cells: list[tuple[Any, int]]
    ) -> Any:
        own_cells = unary_union([cell for cell, owner in cells if owner == number])
        reach = unary_union([p.buffer(self._reach_m) for p, owner in points if owner == number])
        return shapely.transform(own_cells.intersection(reach), self._lonlat)

    def _xy(self, lat: float, lon: float) -> tuple[float, float]:
        return ((lon - self._lon0) * self._kx, (lat - self._lat0) * EARTH_M_PER_DEG)

    def _lonlat(self, coords: Any) -> Any:
        scale = (self._kx, EARTH_M_PER_DEG)
        return coords / scale + (self._lon0, self._lat0)
