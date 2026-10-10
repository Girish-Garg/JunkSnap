# /// script
# requires-python = ">=3.12"
# dependencies = ["shapely>=2.1"]
# ///
"""Simplify data/boundaries/*.geojson into small map layers for the web app.

Writes into frontend/public/boundaries:
- <layer>.geojson: polygons simplified as one coverage (mapshaper style, shared edges stay
  shared) with the smallest tolerance that fits the layer's byte budget;
- <layer>_fine.geojson: near-original edges for close zooms, when they fit the fine budget
  (only the areas matching `fine_prefix`; the rest keep their simplified shape);
- <layer>_labels.geojson: one marker point per area, the pole of inaccessibility of the original
  shape (polylabel), so markers never fall outside odd-shaped areas;
- index.json: which layers and fine files exist, with counts, sizes and ward coverage.

Rerun it when new ward files arrive:  uv run scripts/simplify_boundaries.py
"""

import gzip
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from boundary_geometry import label_point, rounded_geometry, simplify, without_overlaps
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "data" / "boundaries"
OUT_DIR = ROOT / "frontend" / "public" / "boundaries"
# Ward counts per local body, for the "34 of 100 wards" line in the map legend.
LOCAL_BODIES = ROOT / "data" / "representatives" / "local_bodies.json"
# Degrees; tried smallest first until the layer fits its budget.
TOLERANCES = (0.0005, 0.001, 0.002, 0.004, 0.008, 0.016, 0.024, 0.032)
FINE_TOLERANCES = (0.0, 0.0001, 0.0002, 0.0005)
DECIMALS = 4  # about 11 m
FINE_DECIMALS = 5  # about 1 m

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
    clip_overlaps: bool = False


WARDS_CREDIT = (
    "Approximate, unreviewed wards from the 2025 ward-formation orders (Rajasthan Gazette); "
    "places © OpenStreetMap contributors (ODbL) and ECI polling stations "
    "(CC0 as declared by the ramSeraph/indian_facilities copy)"
)

LAYERS = (
    LayerSpec("assembly", "rajasthan_assembly.geojson", ("id", "name", "pc_id"), 400_000, 800_000),
    # Fine edges for Rajasthan only, where the seats are rebuilt from polling stations.
    LayerSpec(
        "loksabha", "india_loksabha.geojson", ("id", "name", "status"), 600_000, 900_000, "s20-"
    ),
    LayerSpec(
        "wards",
        "*_wards.geojson",
        ("id", "ward_no", "name", "zone", "confidence", "review_status"),
        400_000,
        800_000,
        attribution=WARDS_CREDIT,
        clip_overlaps=True,
    ),
)


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

    def manifest(self) -> dict[str, Any]:
        out: dict[str, Any] = {
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
    return without_overlaps(out, decimals) if spec.clip_overlaps else out


def marker_name(properties: dict[str, Any]) -> str:
    """The area's name; crawled wards often have none, so "Ward <n>", else the id."""
    if properties.get("name"):
        return str(properties["name"])
    if properties.get("ward_no") is not None:
        return f"Ward {properties['ward_no']}"
    return str(properties.get("id", ""))


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
                    "name": marker_name(feature["properties"]),
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


def write_layer(spec: LayerSpec, source_dir: Path, out_dir: Path) -> LayerResult | None:
    paths = sorted(source_dir.glob(spec.pattern))
    if not paths:
        return None
    features = read_features(paths)
    coarse = fit_budget(features, spec)
    labels_list = build_labels(features)
    labels = Encoded(labels_list, encode(labels_list), 0.0)
    fine = fit_fine(features, spec, coarse)
    write(out_dir / f"{spec.name}.geojson", coarse.text)
    write(out_dir / f"{spec.name}_labels.geojson", labels.text)
    if fine:
        write(out_dir / f"{spec.name}_fine.geojson", fine.text)
    else:
        (out_dir / f"{spec.name}_fine.geojson").unlink(missing_ok=True)
    sources = tuple(p.name for p in paths)
    return LayerResult(spec.name, coarse, labels, fine, sources, spec.attribution)


def ward_coverage(wards_path: Path, bodies_path: Path) -> list[dict[str, Any]]:
    """Per local body: wards mapped (ids `<body>-w<n>`) against the body's ward count."""
    ids = [f["properties"].get("id", "") for f in read_features([wards_path])]
    bodies = json.loads(bodies_path.read_text(encoding="utf-8")) if bodies_path.exists() else []
    coverage = []
    for body in bodies:
        mapped = sum(1 for ward_id in ids if str(ward_id).startswith(f"{body['id']}-w"))
        if mapped:
            town = (body.get("towns") or [body["name"]])[0]
            wards = body.get("wards")
            coverage.append({"body": body["id"], "town": town, "mapped": mapped, "wards": wards})
    return coverage


def run(
    source_dir: Path,
    out_dir: Path,
    specs: tuple[LayerSpec, ...] = LAYERS,
    bodies_path: Path = LOCAL_BODIES,
) -> list[LayerResult]:
    out_dir.mkdir(parents=True, exist_ok=True)
    results = [r for spec in specs if (r := write_layer(spec, source_dir, out_dir)) is not None]
    for stale in {s.name for s in specs} - {r.name for r in results}:
        for suffix in (".geojson", "_labels.geojson", "_fine.geojson"):
            (out_dir / f"{stale}{suffix}").unlink(missing_ok=True)
    manifest: dict[str, Any] = {"layers": {r.name: r.manifest() for r in results}}
    if "wards" in manifest["layers"]:
        coverage = ward_coverage(out_dir / "wards.geojson", bodies_path)
        manifest["layers"]["wards"]["coverage"] = coverage
    write(out_dir / "index.json", json.dumps(manifest, indent=2) + "\n")
    return results


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
