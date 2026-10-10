"""Marker points (polylabel) and fine edges in scripts/simplify_boundaries.py.

Run with: uv run --with shapely --with pytest pytest scripts/tests -q
"""

import json
import sys
from pathlib import Path

from shapely.geometry import Point, Polygon, shape

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import simplify_boundaries as sb  # noqa: E402
from boundary_geometry import label_point  # noqa: E402

# A thin C shape: its centroid falls in the empty middle, outside the area.
C_SHAPE = [[0, 0], [10, 0], [10, 2], [2, 2], [2, 8], [10, 8], [10, 10], [0, 10], [0, 0]]


def feature(props: dict[str, object], ring: list[list[float]]) -> dict[str, object]:
    return {
        "type": "Feature",
        "properties": props,
        "geometry": {"type": "Polygon", "coordinates": [ring]},
    }


def write(path: Path, features: list[dict[str, object]]) -> None:
    path.write_text(
        json.dumps({"type": "FeatureCollection", "features": features}), encoding="utf-8"
    )


def read(path: Path) -> list[dict[str, object]]:
    return json.loads(path.read_text(encoding="utf-8"))["features"]


def test_label_point_is_inside_odd_shapes_where_the_centroid_is_not() -> None:
    polygon = Polygon(C_SHAPE)
    assert not polygon.contains(polygon.centroid)
    x, y = label_point(polygon)
    assert polygon.contains(Point(x, y))
    # The pole sits in the thick spine, about as far from the edges as the spine allows.
    assert polygon.exterior.distance(Point(x, y)) >= 0.9


def test_label_point_uses_the_largest_part_of_a_multipolygon() -> None:
    small = Polygon([[20, 20], [21, 20], [21, 21], [20, 21]])
    big = Polygon([[0, 0], [10, 0], [10, 10], [0, 10]])
    x, y = label_point(big.union(small))
    assert big.contains(Point(x, y))


def test_label_files_carry_the_pole_of_each_original_shape(tmp_path: Path) -> None:
    source, out = tmp_path / "src", tmp_path / "out"
    source.mkdir()
    write(
        source / "rajasthan_assembly.geojson", [feature({"id": "s20-ac-1", "name": "C"}, C_SHAPE)]
    )
    sb.run(source, out)
    [label] = read(out / "assembly_labels.geojson")
    assert label["properties"] == {"id": "s20-ac-1", "name": "C"}
    assert Polygon(C_SHAPE).contains(Point(label["geometry"]["coordinates"]))


def test_unnamed_wards_get_a_ward_number_marker(tmp_path: Path) -> None:
    source, out = tmp_path / "src", tmp_path / "out"
    source.mkdir()
    ward = feature({"id": "jodhpur-mc-w7", "ward_no": 7, "name": None}, C_SHAPE)
    write(source / "jodhpur_wards.geojson", [ward])
    sb.run(source, out)
    [label] = read(out / "wards_labels.geojson")
    assert label["properties"] == {"id": "jodhpur-mc-w7", "name": "Ward 7"}


def wiggly_square(west: float, prefix: str) -> dict[str, object]:
    edge = [[west + 0.5 + 0.00002 * (i % 2), 26 + i / 500] for i in range(501)]
    ring = [[west, 26.0], *edge, [west, 27.0], [west, 26.0]]
    return feature({"id": f"{prefix}-pc-1", "name": prefix, "status": "current"}, ring)


def test_fine_file_keeps_original_edges_for_the_chosen_areas_only(tmp_path: Path) -> None:
    source, out = tmp_path / "src", tmp_path / "out"
    source.mkdir()
    write(
        source / "india_loksabha.geojson", [wiggly_square(70.0, "s20"), wiggly_square(80.0, "s08")]
    )
    spec = sb.LayerSpec(
        "loksabha", "india_loksabha.geojson", ("id", "status"), 3_000, 60_000, "s20-"
    )
    [result] = sb.run(source, out, (spec,))
    assert result.fine is not None and result.fine.tolerance == 0.0
    fine = {
        f["properties"]["id"]: shape(f["geometry"]) for f in read(out / "loksabha_fine.geojson")
    }
    coarse = {f["properties"]["id"]: shape(f["geometry"]) for f in read(out / "loksabha.geojson")}
    assert len(fine["s20-pc-1"].exterior.coords) > 400
    assert fine["s08-pc-1"].equals(coarse["s08-pc-1"])
    assert json.loads((out / "index.json").read_text(encoding="utf-8"))["layers"]["loksabha"][
        "fine"
    ]


def test_no_fine_file_when_it_does_not_fit(tmp_path: Path) -> None:
    source, out = tmp_path / "src", tmp_path / "out"
    source.mkdir()
    write(source / "india_loksabha.geojson", [wiggly_square(70.0, "s20")])
    spec = sb.LayerSpec("loksabha", "india_loksabha.geojson", ("id",), 3_000, 1_000, "s20-")
    [result] = sb.run(source, out, (spec,))
    assert result.fine is None
    assert not (out / "loksabha_fine.geojson").exists()
    assert (
        "fine"
        not in json.loads((out / "index.json").read_text(encoding="utf-8"))["layers"]["loksabha"]
    )
