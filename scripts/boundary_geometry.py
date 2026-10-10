"""Geometry helpers for scripts/simplify_boundaries.py: simplify, round, label points."""

from typing import Any

import shapely
from shapely.geometry import mapping, shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import polylabel

MIN_RING_POINTS = 4
# Polylabel stops when the best cell is within this share of the part's longer side.
LABEL_PRECISION = 0.002


def simplify(geoms: list[BaseGeometry], tolerance: float) -> list[BaseGeometry]:
    """Coverage simplification keeps neighbours' shared edges identical; else per polygon."""
    if tolerance <= 0:
        return geoms
    if shapely.coverage_is_valid(geoms):
        return list(shapely.coverage_simplify(geoms, tolerance))
    return [g.simplify(tolerance, preserve_topology=True) for g in geoms]


def round_ring(ring: list[list[float]], decimals: int) -> list[list[float]]:
    out: list[list[float]] = []
    for lon, lat, *_ in ring:
        point = [round(lon, decimals), round(lat, decimals)]
        if not out or out[-1] != point:
            out.append(point)
    return out if len(out) >= MIN_RING_POINTS else []


def round_polygon(rings: list[Any], decimals: int) -> list[Any]:
    rounded = [round_ring(ring, decimals) for ring in rings]
    if not rounded or not rounded[0]:
        return []
    return [ring for ring in rounded if ring]


def rounded_geometry(geom: BaseGeometry, decimals: int) -> dict[str, Any] | None:
    """GeoJSON geometry with coordinates at `decimals` places; None when nothing is left."""
    data = mapping(geom)
    if data["type"] == "Polygon":
        polygons = [round_polygon(data["coordinates"], decimals)]
    elif data["type"] == "MultiPolygon":
        polygons = [round_polygon(p, decimals) for p in data["coordinates"]]
    else:
        return None
    polygons = [p for p in polygons if p]
    if not polygons:
        return None
    if len(polygons) == 1:
        return {"type": "Polygon", "coordinates": polygons[0]}
    return {"type": "MultiPolygon", "coordinates": polygons}


def without_overlaps(features: list[dict[str, Any]], decimals: int = 4) -> list[dict[str, Any]]:
    """Cuts each area by the ones before it (one-grid margin), so rounding leaves no slivers."""
    grid = 10.0**-decimals
    taken: BaseGeometry | None = None
    out: list[dict[str, Any]] = []
    for feature in features:
        geom = shape(feature["geometry"])
        if taken is not None:
            geom = geom.difference(taken.buffer(grid * 1.5))
        geometry = rounded_geometry(shapely.set_precision(geom, grid), decimals)
        if geometry is None:
            continue
        out.append({**feature, "geometry": geometry})
        written = shape(geometry)
        taken = written if taken is None else taken.union(written)
    return out


def label_point(geom: BaseGeometry) -> tuple[float, float]:
    """Pole of inaccessibility of the largest part: the inside point farthest from any edge."""
    parts = list(getattr(geom, "geoms", [geom]))
    largest = max(parts, key=lambda part: part.area).buffer(0)
    if largest.geom_type == "MultiPolygon":
        largest = max(largest.geoms, key=lambda part: part.area)
    min_x, min_y, max_x, max_y = largest.bounds
    precision = max(max_x - min_x, max_y - min_y) * LABEL_PRECISION
    point = polylabel(largest, tolerance=precision)
    if not largest.contains(point):
        point = largest.point_on_surface()
    return point.x, point.y
