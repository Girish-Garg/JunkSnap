"""Writes ward polygons as GeoJSON, checks them, and draws a PNG."""

import json
import math
from pathlib import Path
from typing import Any

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import shapely  # noqa: E402
from shapely.geometry import mapping, shape  # noqa: E402
from shapely.ops import unary_union  # noqa: E402

from ward_boundaries.adapters.shapely_ward_builder import WardShape  # noqa: E402
from ward_boundaries.domain.privacy import PersonGuard  # noqa: E402

KM2_PER_DEG2 = 111.32 * 110.57


GRID_DEG = 0.00001  # about 1 m; the written coordinates sit on this grid


class CoverageCleaner:
    """Snaps wards to the written grid and cuts each by the wards before it, so none overlap."""

    def clean(self, shapes: tuple[WardShape, ...]) -> tuple[WardShape, ...]:
        cleaned: list[WardShape] = []
        taken = None
        for ward_shape in shapes:
            geometry = shapely.set_precision(ward_shape.geometry, GRID_DEG)
            if taken is not None:
                # A one-grid margin: snapping the cut edge can then never cross into a neighbour.
                cut = geometry.difference(taken.buffer(GRID_DEG * 1.5))
                geometry = shapely.set_precision(cut, GRID_DEG)
            if geometry.is_empty:
                continue
            cleaned.append(WardShape(ward_shape.evidence, geometry))
            taken = geometry if taken is None else taken.union(geometry)
        return tuple(cleaned)


class WardFeatures:
    def __init__(self, body_id: str, body_name: str, lat0: float) -> None:
        self._body_id = body_id
        self._body_name = body_name
        self._km2 = KM2_PER_DEG2 * math.cos(math.radians(lat0))
        self._guard = PersonGuard()

    def collection(self, shapes: tuple[WardShape, ...]) -> dict[str, Any]:
        return {"type": "FeatureCollection", "features": [self._feature(s) for s in shapes]}

    def _model(self, model: str) -> dict[str, str]:
        """Bedrock ids carry a routing prefix (global., apac., in.); the version is the base id."""
        prefix, _, base = model.partition(".")
        version = base if prefix in ("global", "apac", "in", "us", "eu") else model
        return {"provider": "bedrock", "model": model, "version": version}

    def _feature(self, shape: WardShape) -> dict[str, Any]:
        ward = shape.evidence
        properties = {
            "id": f"{self._body_id}-w{ward.number}",
            "ward_no": ward.number,
            "name": None,
            "zone": None,
            "offices": [
                self._guard.clean(
                    f"Ward councillor (parshad), ward {ward.number}, {self._body_name}"
                )
            ],
            "confidence": ward.confidence(),
            "review_status": "unreviewed",
            "population": ward.population,
            "localities_listed": len(ward.listed),
            "localities_found": ward.places_found(),
            "area_km2": round(shape.geometry.area * self._km2, 3),
            **ward.sources[0].provenance(),
            "sources": [source.provenance() for source in ward.sources],
            "notes": [self._guard.clean(note) for note in ward.notes],
            "models": [self._model(model) for model in ward.models],
        }
        geometry = json.loads(
            json.dumps(mapping(shape.geometry)),
            parse_float=lambda value: round(float(value), 5),
        )
        return {"type": "Feature", "properties": properties, "geometry": geometry}


class WardChecks:
    """Validity, overlaps between wards and the total area covered."""

    def __init__(self, lat0: float) -> None:
        self._km2 = KM2_PER_DEG2 * math.cos(math.radians(lat0))

    def report_file(self, path: Path) -> dict[str, float | int]:
        """Checks the geometry as written to the file, not the in-memory one."""
        features = json.loads(path.read_text(encoding="utf-8"))["features"]
        return self.report([shape(feature["geometry"]) for feature in features])

    def report(self, geometries: list[Any]) -> dict[str, float | int]:
        overlap = sum(
            a.intersection(b).area
            for i, a in enumerate(geometries)
            for b in geometries[i + 1 :]
            if a.intersects(b)
        )
        union_area = unary_union(geometries).area if geometries else 0.0
        return {
            "wards": len(geometries),
            "invalid": sum(1 for g in geometries if not g.is_valid),
            "multipart": sum(1 for g in geometries if g.geom_type == "MultiPolygon"),
            "overlap_km2": round(overlap * self._km2, 6),
            "union_km2": round(union_area * self._km2, 2),
        }


class WardMap:
    def draw(
        self,
        shapes: tuple[WardShape, ...],
        title: str,
        path: Path,
        context: list[tuple[float, float]],
    ) -> None:
        """Wards over grey dots: every mapped place and polling station in the city box."""
        figure, axes = plt.subplots(figsize=(11, 11))
        axes.scatter([lon for lon, _ in context], [lat for _, lat in context], s=2, c="#bbbbbb")
        for ward in shapes:
            for part in getattr(ward.geometry, "geoms", [ward.geometry]):
                xs, ys = part.exterior.xy
                axes.fill(xs, ys, alpha=0.25 + 0.5 * ward.evidence.confidence(), lw=0.6)
                axes.plot(xs, ys, color="black", lw=0.4)
            point = ward.geometry.representative_point()
            axes.annotate(str(ward.evidence.number), (point.x, point.y), fontsize=6, ha="center")
        axes.set_title(title)
        axes.set_xlabel("longitude")
        axes.set_ylabel("latitude")
        axes.set_aspect(1.1)
        figure.savefig(path, dpi=130, bbox_inches="tight")
        plt.close(figure)
