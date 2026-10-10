# /// script
# requires-python = ">=3.12"
# dependencies = ["shapely>=2.1"]
# ///
"""Simplify data/boundaries/*.geojson into small map layers for the web app.

Builds each layer in memory: polygons simplified as one coverage (mapshaper style, shared edges
stay shared) at the smallest tolerance that fits the layer's byte budget; near-original edges for
close zooms when they fit the fine budget (only areas matching `fine_prefix`); one marker point per
area at the pole of inaccessibility of the original shape (polylabel).

Writes only what the app loads into frontend/public/boundaries: the combined areas layer
(areas.geojson, areas_labels.geojson, areas_fine.geojson; see combined_areas.py) and index.json.
Other files there are removed. Rerun when a boundary file changes:

    uv run scripts/simplify_boundaries.py
"""

import gzip
import hashlib
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from boundary_geometry import label_point, rounded_geometry, simplify
from combined_areas import combine, combine_points
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "data" / "boundaries"
OUT_DIR = ROOT / "frontend" / "public" / "boundaries"
# Degrees; tried smallest first until the layer fits its budget.
TOLERANCES = (0.0005, 0.001, 0.002, 0.004, 0.008, 0.016, 0.024, 0.032)
FINE_TOLERANCES = (0.0, 0.0001, 0.0002, 0.0005)
DECIMALS = 4  # about 11 m
FINE_DECIMALS = 5  # about 1 m
# The map draws only the combined areas layer; its fine file is skipped above this size.
AREAS_FINE_BUDGET = 1_300_000

Feature = dict[str, Any]


@dataclass(frozen=True)
class LayerSpec:
    """One map layer: sources, kept properties, byte budgets, which areas get fine edges."""

    name: str
    pattern: str
    keep: tuple[str, ...]
    budget_bytes: int
    fine_budget_bytes: int = 0
    fine_prefix: str = ""
    attribution: str = ""


ASSEMBLY = LayerSpec(
    "assembly", "rajasthan_assembly.geojson", ("id", "name", "pc_id"), 400_000, 800_000
)
# Fine edges for Rajasthan only, where the seats are rebuilt from polling stations.
LOKSABHA = LayerSpec(
    "loksabha", "india_loksabha.geojson", ("id", "name", "status"), 600_000, 900_000, "s20-"
)
# Only what the combined areas layer needs; ward files are not on the web map.
LAYERS = (ASSEMBLY, LOKSABHA)


@dataclass(frozen=True)
class Encoded:
    """One written file: its features, text and tolerance."""

    features: list[Feature]
    text: str
    tolerance: float

    @property
    def bytes(self) -> int:
        return len(self.text.encode("utf-8"))


@dataclass(frozen=True)
class LayerResult:
    """What one run wrote for a layer."""

    name: str
    coarse: Encoded
    labels: Encoded
    fine: Encoded | None
    sources: tuple[str, ...]
    attribution: str = ""

    @property
    def version(self) -> str:
        """Content hash of the layer's files; the app puts it in their URLs to bust old copies."""
        digest = hashlib.sha256()
        for encoded in (self.coarse, self.labels, self.fine):
            digest.update(encoded.text.encode("utf-8") if encoded else b"")
        return digest.hexdigest()[:16]

    def manifest(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "version": self.version,
            "features": len(self.coarse.features),
            "bytes": self.coarse.bytes,
            "label_bytes": self.labels.bytes,
            "tolerance_deg": self.coarse.tolerance,
            "sources": list(self.sources),
        }
        if self.fine:
            out["fine"] = {"bytes": self.fine.bytes, "tolerance_deg": self.fine.tolerance}
        if self.attribution:
            out["attribution"] = self.attribution
        return out


def read_features(paths: list[Path]) -> list[Feature]:
    features: list[Feature] = []
    for path in paths:
        features.extend(json.loads(path.read_text(encoding="utf-8"))["features"])
    return [f for f in features if f.get("geometry")]


def kept(properties: dict[str, Any], keep: tuple[str, ...]) -> dict[str, Any]:
    return {key: properties[key] for key in keep if key in properties}


def build_polygons(
    features: list[Feature], spec: LayerSpec, tolerance: float, decimals: int
) -> list[Feature]:
    geoms = [shape(f["geometry"]) for f in features]
    out: list[Feature] = []
    for feature, geom in zip(features, simplify(geoms, tolerance), strict=True):
        geometry = rounded_geometry(geom, decimals)
        if geometry is not None:
            out.append(
                {
                    "type": "Feature",
                    "properties": kept(feature["properties"], spec.keep),
                    "geometry": geometry,
                }
            )
    return out


def build_labels(features: list[Feature]) -> list[Feature]:
    """One marker point per area, from its original shape."""
    labels: list[Feature] = []
    for feature in features:
        x, y = label_point(shape(feature["geometry"]))
        labels.append(
            {
                "type": "Feature",
                "properties": {
                    "id": feature["properties"].get("id"),
                    "name": feature["properties"].get("name") or feature["properties"].get("id"),
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(x, FINE_DECIMALS), round(y, FINE_DECIMALS)],
                },
            }
        )
    return labels


def encode(features: list[Feature]) -> str:
    return json.dumps(
        {"type": "FeatureCollection", "features": features},
        ensure_ascii=False,
        separators=(",", ":"),
    )


def fit_budget(features: list[Feature], spec: LayerSpec) -> Encoded:
    """The smallest tolerance whose output fits the budget, else the largest tried."""
    for tolerance in TOLERANCES:
        polygons = build_polygons(features, spec, tolerance, DECIMALS)
        encoded = Encoded(polygons, encode(polygons), tolerance)
        if encoded.bytes <= spec.budget_bytes:
            break
    return encoded


def fit_fine(features: list[Feature], spec: LayerSpec, coarse: Encoded) -> Encoded | None:
    """Near-original edges for `fine_prefix` areas plus the coarse rest, if it fits."""
    if spec.fine_budget_bytes <= 0:
        return None
    chosen = [
        f for f in features if str(f["properties"].get("id", "")).startswith(spec.fine_prefix)
    ]
    ids = {f["properties"].get("id") for f in chosen}
    rest = [f for f in coarse.features if f["properties"].get("id") not in ids]
    for tolerance in (t for t in FINE_TOLERANCES if t < coarse.tolerance):
        polygons = build_polygons(chosen, spec, tolerance, FINE_DECIMALS) + rest
        encoded = Encoded(polygons, encode(polygons), tolerance)
        if encoded.bytes <= spec.fine_budget_bytes:
            return encoded
    return None


def write(path: Path, text: str) -> None:
    path.write_bytes(text.encode("utf-8"))


def build_layer(spec: LayerSpec, source_dir: Path) -> LayerResult | None:
    paths = sorted(source_dir.glob(spec.pattern))
    if not paths:
        return None
    features = read_features(paths)
    coarse = fit_budget(features, spec)
    labels_list = build_labels(features)
    labels = Encoded(labels_list, encode(labels_list), 0.0)
    fine = fit_fine(features, spec, coarse)
    sources = tuple(p.name for p in paths)
    return LayerResult(spec.name, coarse, labels, fine, sources, spec.attribution)


def build_areas(results: list[LayerResult]) -> LayerResult | None:
    """The one layer the map draws: assembly seats in Rajasthan, Lok Sabha seats elsewhere."""
    by_name = {r.name: r for r in results}
    assembly, loksabha = by_name.get("assembly"), by_name.get("loksabha")
    if not assembly or not loksabha:
        return None

    def encoded(a: Encoded, b: Encoded, decimals: int) -> Encoded:
        features = combine(a.features, b.features, decimals)
        return Encoded(features, encode(features), max(a.tolerance, b.tolerance))

    coarse = encoded(assembly.coarse, loksabha.coarse, DECIMALS)
    points = combine_points(assembly.labels.features, loksabha.labels.features)
    labels = Encoded(points, encode(points), 0.0)
    fine: Encoded | None = encoded(assembly.fine or assembly.coarse, loksabha.coarse, FINE_DECIMALS)
    if fine and fine.bytes > AREAS_FINE_BUDGET:
        fine = None
    return LayerResult("areas", coarse, labels, fine, assembly.sources + loksabha.sources)


def write_layer(result: LayerResult, out_dir: Path) -> list[Path]:
    """Writes a layer's files; returns their paths."""
    files = {"": result.coarse, "_labels": result.labels, "_fine": result.fine}
    written = []
    for suffix, encoded in files.items():
        if encoded is not None:
            path = out_dir / f"{result.name}{suffix}.geojson"
            write(path, encoded.text)
            written.append(path)
    return written


def run(
    source_dir: Path, out_dir: Path, specs: tuple[LayerSpec, ...] = LAYERS
) -> list[LayerResult]:
    """Builds the seat layers and writes the areas layer and index.json; removes any other file."""
    out_dir.mkdir(parents=True, exist_ok=True)
    results = [r for spec in specs if (r := build_layer(spec, source_dir)) is not None]
    areas = build_areas(results)
    written = set(write_layer(areas, out_dir)) if areas else set()
    for stale in set(out_dir.glob("*.geojson")) - written:
        stale.unlink()
    manifest = {"layers": {areas.name: areas.manifest()} if areas else {}}
    write(out_dir / "index.json", json.dumps(manifest, indent=2) + "\n")
    return [*results, *([areas] if areas else [])]


def kb(text: str) -> str:
    raw = text.encode("utf-8")
    return f"{len(raw) / 1000:.0f} KB ({len(gzip.compress(raw)) / 1000:.0f} KB gzipped)"


def main() -> int:
    for r in run(SOURCE_DIR, OUT_DIR):
        fine = f", fine {kb(r.fine.text)} at {r.fine.tolerance} deg" if r.fine else ", no fine file"
        print(
            f"{r.name}: {len(r.coarse.features)} areas, {kb(r.coarse.text)} at "
            f"{r.coarse.tolerance} deg, labels {kb(r.labels.text)}{fine}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
