"""Tests for scripts/simplify_boundaries.py.

Run with: uv run --with shapely --with pytest pytest scripts/tests -q
"""

import json
import math
import sys
from pathlib import Path

import pytest
from shapely.geometry import Point, shape

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import simplify_boundaries as sb  # noqa: E402
from boundary_geometry import without_overlaps  # noqa: E402

STEPS = 400


def wiggly_edge(x: float) -> list[list[float]]:
    """A north-south edge at x with many tiny wiggles, shared by two neighbours."""
    return [[x + 0.00001 * math.sin(i), 26.0 + i / STEPS] for i in range(STEPS + 1)]


def square(west: float, east: float, shared_on_east: bool) -> list[list[float]]:
    edge = wiggly_edge(east if shared_on_east else west)
    if shared_on_east:
        return [[west, 26.0], *edge, [west, 27.0], [west, 26.0]]
    return [*edge, [east, 27.0], [east, 26.0], [west, 26.0]]


def collection(features: list[tuple[dict[str, object], list[list[float]]]]) -> str:
    return json.dumps(
        {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": props,
                    "geometry": {"type": "Polygon", "coordinates": [ring]},
                }
                for props, ring in features
            ],
        }
    )


def seats(tmp: Path) -> None:
    west = {"id": "s20-ac-1", "name": "West", "pc_id": "s20-pc-1", "category": "GEN"}
    east = {"id": "s20-ac-2", "name": "East", "pc_id": "s20-pc-1", "category": "SC"}
    left = (west, square(73.0, 73.5, True))
    right = (east, square(73.5, 74.0, False))
    (tmp / "rajasthan_assembly.geojson").write_text(collection([left, right]), encoding="utf-8")


def ship(spec: sb.LayerSpec, source: Path, out: Path) -> sb.LayerResult:
    """Builds and writes one layer, as the tests inspect it."""
    out.mkdir(parents=True, exist_ok=True)
    result = sb.build_layer(spec, source)
    assert result is not None
    sb.write_layer(result, out)
    return result


def read(path: Path) -> list[dict[str, object]]:
    return json.loads(path.read_text(encoding="utf-8"))["features"]


@pytest.fixture
def dirs(tmp_path: Path) -> tuple[Path, Path]:
    source, out = tmp_path / "src", tmp_path / "out"
    source.mkdir()
    seats(source)
    return source, out


def test_keeps_only_listed_properties_and_counts_them(dirs: tuple[Path, Path]) -> None:
    source, out = dirs
    result = ship(sb.ASSEMBLY, source, out)
    features = read(out / "assembly.geojson")
    assert [f["properties"] for f in features] == [
        {"id": "s20-ac-1", "name": "West", "pc_id": "s20-pc-1"},
        {"id": "s20-ac-2", "name": "East", "pc_id": "s20-pc-1"},
    ]
    assert result.manifest()["features"] == 2


def test_simplifies_and_keeps_shared_edges_identical(dirs: tuple[Path, Path]) -> None:
    source, out = dirs
    spec = sb.LayerSpec("assembly", "rajasthan_assembly.geojson", ("id",), 2_000)
    result = ship(spec, source, out)
    assert result.coarse.bytes <= 2_000
    left, right = (shape(f["geometry"]) for f in read(out / "assembly.geojson"))
    assert len(left.exterior.coords) < STEPS / 4
    assert left.intersection(right).area == pytest.approx(0, abs=1e-9)
    assert left.union(right).area == pytest.approx(1.0 * 0.5 * 2, rel=0.01)


def test_labels_fall_inside_their_area(dirs: tuple[Path, Path]) -> None:
    source, out = dirs
    ship(sb.ASSEMBLY, source, out)
    polygons = {f["properties"]["id"]: shape(f["geometry"]) for f in read(out / "assembly.geojson")}
    for label in read(out / "assembly_labels.geojson"):
        point = Point(label["geometry"]["coordinates"])
        assert polygons[label["properties"]["id"]].buffer(1e-4).contains(point)


def test_rounds_coordinates_to_four_places(dirs: tuple[Path, Path]) -> None:
    source, out = dirs
    ship(sb.ASSEMBLY, source, out)
    ring = read(out / "assembly.geojson")[0]["geometry"]["coordinates"][0]
    assert all(round(value, 4) == value for point in ring for value in point)


def test_clipped_layers_have_no_overlaps_after_rounding() -> None:
    discs = [Point(73.0, 26.3).buffer(0.01), Point(73.015, 26.3).buffer(0.01)]
    features = [
        {"type": "Feature", "properties": {"id": f"w{i}"}, "geometry": disc.__geo_interface__}
        for i, disc in enumerate(discs)
    ]

    first, second = (shape(f["geometry"]) for f in without_overlaps(features))

    assert first.intersection(second).area == 0
