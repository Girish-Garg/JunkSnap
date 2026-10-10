"""The combined areas layer in scripts/simplify_boundaries.py.

Run with: uv run --with shapely --with pytest pytest scripts/tests -q
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pytest  # noqa: E402
import simplify_boundaries as sb  # noqa: E402
from combined_areas import combine  # noqa: E402
from shapely.geometry import Polygon, shape  # noqa: E402

SQUARE = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]


def shifted(dx: float) -> list[list[float]]:
    return [[x + dx, y] for x, y in SQUARE]


def collection(features: list[tuple[dict[str, object], list[list[float]]]]) -> str:
    return json.dumps(
        {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": p,
                    "geometry": {"type": "Polygon", "coordinates": [r]},
                }
                for p, r in features
            ],
        }
    )


def read(path: Path) -> list[dict[str, object]]:
    return json.loads(path.read_text(encoding="utf-8"))["features"]


def test_areas_use_assembly_seats_where_they_exist_and_lok_sabha_elsewhere(tmp_path: Path) -> None:
    source, out = tmp_path / "src", tmp_path / "out"
    source.mkdir()
    (source / "rajasthan_assembly.geojson").write_text(
        collection([({"id": "s20-ac-1", "name": "A"}, shifted(0))]), encoding="utf-8"
    )
    (source / "india_loksabha.geojson").write_text(
        collection(
            [
                ({"id": "s20-pc-1", "name": "Raj", "status": "current"}, shifted(0)),
                ({"id": "s08-pc-1", "name": "Other", "status": "current"}, shifted(5)),
            ]
        ),
        encoding="utf-8",
    )
    sb.run(source, out)
    areas = [(f["properties"]["id"], f["properties"]["kind"]) for f in read(out / "areas.geojson")]
    assert areas == [("s20-ac-1", "assembly"), ("s08-pc-1", "loksabha")]
    labels = [
        (f["properties"]["id"], f["properties"]["kind"]) for f in read(out / "areas_labels.geojson")
    ]
    assert labels == areas
    fine = [f["properties"]["id"] for f in read(out / "areas_fine.geojson")]
    assert fine == ["s20-ac-1", "s08-pc-1"]
    assert "areas" in json.loads((out / "index.json").read_text(encoding="utf-8"))["layers"]


def test_no_areas_layer_without_both_seat_files(tmp_path: Path) -> None:
    source, out = tmp_path / "src", tmp_path / "out"
    source.mkdir()
    (source / "rajasthan_assembly.geojson").write_text(
        collection([({"id": "s20-ac-1", "name": "A"}, shifted(0))]), encoding="utf-8"
    )
    sb.run(source, out)
    assert not (out / "areas.geojson").exists()


def test_ships_only_the_areas_layer_and_clears_old_files(tmp_path: Path) -> None:
    source, out = tmp_path / "src", tmp_path / "out"
    source.mkdir()
    out.mkdir()
    (out / "assembly.geojson").write_text("{}", encoding="utf-8")
    (source / "rajasthan_assembly.geojson").write_text(
        collection([({"id": "s20-ac-1", "name": "A"}, shifted(0))]), encoding="utf-8"
    )
    (source / "india_loksabha.geojson").write_text(
        collection([({"id": "s08-pc-1", "name": "B", "status": "current"}, shifted(5))]),
        encoding="utf-8",
    )
    sb.run(source, out)
    names = sorted(path.name for path in out.iterdir())
    assert names == ["areas.geojson", "areas_fine.geojson", "areas_labels.geojson", "index.json"]
    assert list(json.loads((out / "index.json").read_text(encoding="utf-8"))["layers"]) == ["areas"]


def test_outside_seats_are_cut_back_and_border_slivers_filled() -> None:
    # One assembly seat, and around it an outside seat that overlaps it on the right and leaves
    # a thin gap on the other three sides, as two separately simplified files do.
    assembly = [
        {
            "properties": {"id": "s20-ac-1"},
            "geometry": Polygon([(0, 0), (1, 0), (1, 1), (0, 1)]).__geo_interface__,
        }
    ]
    ring = Polygon([(-1, -1), (2, -1), (2, 2), (-1, 2)]).difference(
        Polygon([(-0.01, -0.01), (0.9, -0.01), (0.9, 1.01), (-0.01, 1.01)])
    )
    outside = [{"properties": {"id": "s08-pc-1"}, "geometry": ring.__geo_interface__}]
    areas = combine(assembly, outside, 6)
    seat, around = (shape(f["geometry"]) for f in areas)
    assert seat.intersection(around).area < 1e-6
    union = seat.union(around)
    assert union.area == pytest.approx(9.0, rel=1e-4)
    assert not list(getattr(union, "interiors", []))
