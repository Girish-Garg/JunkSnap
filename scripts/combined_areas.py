"""The map's one seamless areas layer: assembly seats where they exist, Lok Sabha seats elsewhere.

Rajasthan's Lok Sabha seats are unions of its assembly seats (data/boundaries/SOURCES.md), so
swapping them for the assembly seats leaves the map covered. The two files are simplified apart,
so their edges along the Rajasthan border drift: the outside seats are cut back where they overlap
the assembly seats, and the slivers left between the two are given to the outside seat that
borders each one most. Each feature carries its `kind` so a tap opens the right area page.
"""

from typing import Any

import shapely
from boundary_geometry import rounded_geometry
from shapely.geometry import shape
from shapely.geometry.base import BaseGeometry

Feature = dict[str, Any]

# Lok Sabha seats inside the states that have assembly seats; they are drawn as assembly seats.
ASSEMBLY_STATES = ("s20-",)
# Only outside seats this close to the assembly seats are adjusted (degrees).
NEAR = 0.05
# Holes larger than this are real gaps in the data (or lakes), not drift slivers (square degrees).
MAX_SLIVER = 0.05


def tagged(features: list[Feature], kind: str) -> list[Feature]:
    return [{**f, "properties": {**f["properties"], "kind": kind}} for f in features]


def slivers(region: BaseGeometry) -> list[BaseGeometry]:
    """Small holes inside the joined assembly and outside seats: the gaps their edges leave."""
    parts = list(getattr(region, "geoms", [region]))
    holes = [shapely.Polygon(ring) for part in parts for ring in part.interiors]
    return [hole for hole in holes if hole.area <= MAX_SLIVER]


def owner(hole: BaseGeometry, seats: dict[int, BaseGeometry]) -> int | None:
    """The seat sharing the longest edge with a hole."""
    shared = {i: seat.boundary.intersection(hole.buffer(1e-7)).length for i, seat in seats.items()}
    best = max(shared, key=lambda i: shared[i], default=None)
    return best if best is not None and shared[best] > 0 else None


def fit_to_border(assembly: list[BaseGeometry], outside: list[BaseGeometry]) -> list[BaseGeometry]:
    """Outside seats cut back from the assembly seats, with the border slivers filled in."""
    region = shapely.union_all(assembly)
    near = {i: g.difference(region) for i, g in enumerate(outside) if g.distance(region) < NEAR}
    for hole in slivers(shapely.union_all([region, *near.values()])):
        if (i := owner(hole, near)) is not None:
            near[i] = near[i].union(hole)
    return [near.get(i, g) for i, g in enumerate(outside)]


def polygonal(geom: BaseGeometry) -> BaseGeometry:
    """The polygon parts of a repaired geometry (repairs can add stray lines or points)."""
    valid = shapely.make_valid(geom)
    parts = [
        g for g in getattr(valid, "geoms", [valid]) if g.geom_type in ("Polygon", "MultiPolygon")
    ]
    return shapely.union_all(parts)


def outside_seats(loksabha: list[Feature]) -> list[Feature]:
    return [
        f for f in loksabha if not str(f["properties"].get("id", "")).startswith(ASSEMBLY_STATES)
    ]


def combine_points(assembly: list[Feature], loksabha: list[Feature]) -> list[Feature]:
    """Marker points: the assembly seats' and the outside Lok Sabha seats'."""
    return tagged(assembly, "assembly") + tagged(outside_seats(loksabha), "loksabha")


def combine(assembly: list[Feature], loksabha: list[Feature], decimals: int = 4) -> list[Feature]:
    """Assembly seats, then the other states' Lok Sabha seats fitted to the Rajasthan border."""
    outside = outside_seats(loksabha)
    fitted = fit_to_border(
        [shape(f["geometry"]) for f in assembly], [shape(f["geometry"]) for f in outside]
    )
    adjusted = []
    for feature, geom in zip(outside, fitted, strict=True):
        geometry = rounded_geometry(polygonal(geom), decimals)
        if geometry is not None:
            adjusted.append({**feature, "geometry": geometry})
    return tagged(assembly, "assembly") + tagged(adjusted, "loksabha")
