"""The combined areas layer in scripts/simplify_boundaries.py.

Run with: uv run --with shapely --with pytest pytest scripts/tests -q
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import simplify_boundaries as sb  # noqa: E402

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
