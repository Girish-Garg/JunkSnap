# /// script
# requires-python = ">=3.12"
# dependencies = ["shapely>=2.1"]
# ///
"""Simplify data/boundaries/*.geojson into small map layers for the web app.

Writes frontend/public/boundaries/<layer>.geojson (polygons), <layer>_labels.geojson (one point
per area for its label) and index.json (which layers exist, with counts and sizes). Shared edges
stay shared: the polygons are simplified as one coverage (mapshaper style), with the smallest
tolerance that fits the layer's byte budget. Rerun it when new ward files arrive:

    uv run scripts/simplify_boundaries.py
"""

import gzip
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import shapely
from shapely.geometry import mapping, shape
from shapely.geometry.base import BaseGeometry

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "data" / "boundaries"
OUT_DIR = ROOT / "frontend" / "public" / "boundaries"
# Degrees; tried smallest first until the layer fits its budget.
TOLERANCES = (0.0005, 0.001, 0.002, 0.004, 0.008, 0.016, 0.024, 0.032)
DECIMALS = 4  # about 11 m
MIN_RING_POINTS = 4

Feature = dict[str, Any]


@dataclass(frozen=True)
class LayerSpec:
    """One map layer: which source files feed it, which properties it keeps, its byte budget."""

    name: str
    pattern: str
    keep: tuple[str, ...]
    budget_bytes: int


LAYERS = (
    LayerSpec("assembly", "rajasthan_assembly.geojson", ("id", "name", "pc_id"), 400_000),
    LayerSpec("loksabha", "india_loksabha.geojson", ("id", "name", "status"), 600_000),
    LayerSpec(
        "wards", "*_wards.geojson",
        ("id", "ward_no", "name", "zone", "confidence", "review_status"), 400_000,
    ),
)


@dataclass(frozen=True)
class LayerResult:
    """What one run wrote for a layer."""

    name: str
    features: int
    bytes: int
    label_bytes: int
    tolerance: float
    sources: tuple[str, ...]

    def manifest(self) -> dict[str, Any]:
        return {
            "features": self.features, "bytes": self.bytes, "label_bytes": self.label_bytes,
            "tolerance_deg": self.tolerance, "sources": list(self.sources),
        }


def read_features(paths: list[Path]) -> list[Feature]:
    features: list[Feature] = []
    for path in paths:
        features.extend(json.loads(path.read_text(encoding="utf-8"))["features"])
    return [f for f in features if f.get("geometry")]


def simplify(geoms: list[BaseGeometry], tolerance: float) -> list[BaseGeometry]:
    """Coverage simplification keeps neighbours' shared edges identical; else per polygon."""
    if shapely.coverage_is_valid(geoms):
        return list(shapely.coverage_simplify(geoms, tolerance))
    return [g.simplify(tolerance, preserve_topology=True) for g in geoms]


def round_ring(ring: list[list[float]]) -> list[list[float]]:
    out: list[list[float]] = []
    for lon, lat, *_ in ring:
        point = [round(lon, DECIMALS), round(lat, DECIMALS)]
        if not out or out[-1] != point:
            out.append(point)
    return out if len(out) >= MIN_RING_POINTS else []


def round_polygon(rings: list[Any]) -> list[Any]:
    rounded = [round_ring(ring) for ring in rings]
    if not rounded or not rounded[0]:
        return []
    return [ring for ring in rounded if ring]


def rounded_geometry(geom: BaseGeometry) -> dict[str, Any] | None:
    """GeoJSON geometry with coordinates at DECIMALS places; None when nothing is left."""
    data = mapping(geom)
    if data["type"] == "Polygon":
        polygons = [round_polygon(data["coordinates"])]
    elif data["type"] == "MultiPolygon":
        polygons = [round_polygon(p) for p in data["coordinates"]]
    else:
        return None
    polygons = [p for p in polygons if p]
    if not polygons:
        return None
    if len(polygons) == 1:
        return {"type": "Polygon", "coordinates": polygons[0]}
    return {"type": "MultiPolygon", "coordinates": polygons}


def kept(properties: dict[str, Any], keep: tuple[str, ...]) -> dict[str, Any]:
    return {key: properties[key] for key in keep if key in properties}


def build_polygons(features: list[Feature], spec: LayerSpec, tolerance: float) -> list[Feature]:
    geoms = [shape(f["geometry"]) for f in features]
    out: list[Feature] = []
    for feature, geom in zip(features, simplify(geoms, tolerance), strict=True):
        geometry = rounded_geometry(geom)
        if geometry is not None:
            properties = kept(feature["properties"], spec.keep)
            out.append({"type": "Feature", "properties": properties, "geometry": geometry})
    return out


def build_labels(features: list[Feature]) -> list[Feature]:
    """One point inside each area; the largest part of a multipolygon gets it."""
    labels: list[Feature] = []
    for feature in features:
        geom = shape(feature["geometry"])
        parts = list(getattr(geom, "geoms", [geom]))
        point = max(parts, key=lambda part: part.area).point_on_surface()
        coords = [round(point.x, DECIMALS), round(point.y, DECIMALS)]
        properties = kept(feature["properties"], ("id", "name"))
        labels.append({"type": "Feature", "properties": properties,
                       "geometry": {"type": "Point", "coordinates": coords}})
    return labels


def encode(features: list[Feature]) -> str:
    return json.dumps({"type": "FeatureCollection", "features": features},
                      ensure_ascii=False, separators=(",", ":"))


def fit_budget(features: list[Feature], spec: LayerSpec) -> tuple[list[Feature], str, float]:
    """The smallest tolerance whose output fits the budget, else the largest tried."""
    for tolerance in TOLERANCES:
        polygons = build_polygons(features, spec, tolerance)
        text = encode(polygons)
        if len(text.encode("utf-8")) <= spec.budget_bytes:
            break
    return polygons, text, tolerance


def write_layer(spec: LayerSpec, source_dir: Path, out_dir: Path) -> LayerResult | None:
    paths = sorted(source_dir.glob(spec.pattern))
    if not paths:
        return None
    polygons, text, tolerance = fit_budget(read_features(paths), spec)
    labels = encode(build_labels(polygons))
    (out_dir / f"{spec.name}.geojson").write_bytes(text.encode("utf-8"))
    (out_dir / f"{spec.name}_labels.geojson").write_bytes(labels.encode("utf-8"))
    return LayerResult(spec.name, len(polygons), len(text.encode("utf-8")),
                       len(labels.encode("utf-8")), tolerance, tuple(p.name for p in paths))


def run(
    source_dir: Path, out_dir: Path, specs: tuple[LayerSpec, ...] = LAYERS
) -> list[LayerResult]:
    out_dir.mkdir(parents=True, exist_ok=True)
    results = [r for spec in specs if (r := write_layer(spec, source_dir, out_dir)) is not None]
    for stale in {s.name for s in specs} - {r.name for r in results}:
        for suffix in (".geojson", "_labels.geojson"):
            (out_dir / f"{stale}{suffix}").unlink(missing_ok=True)
    manifest = {"layers": {r.name: r.manifest() for r in results}}
    (out_dir / "index.json").write_bytes((json.dumps(manifest, indent=2) + "\n").encode("utf-8"))
    return results


def main() -> int:
    for result in run(SOURCE_DIR, OUT_DIR):
        path = OUT_DIR / f"{result.name}.geojson"
        zipped = len(gzip.compress(path.read_bytes()))
        print(f"{result.name}: {result.features} areas, {result.bytes / 1000:.0f} KB "
              f"({zipped / 1000:.0f} KB gzipped, +{result.label_bytes / 1000:.0f} KB labels), "
              f"tolerance {result.tolerance} deg")
    return 0


if __name__ == "__main__":
    sys.exit(main())
