"""Ward coverage for the boundary index: wards mapped against each local body's ward count."""

import json
from pathlib import Path
from typing import Any


def ward_coverage(wards_path: Path, bodies_path: Path) -> list[dict[str, Any]]:
    """Per local body: wards mapped (ids `<body>-w<n>`) against the body's ward count."""
    features = json.loads(wards_path.read_text(encoding="utf-8"))["features"]
    ids = [f["properties"].get("id", "") for f in features]
    bodies = json.loads(bodies_path.read_text(encoding="utf-8")) if bodies_path.exists() else []
    coverage = []
    for body in bodies:
        mapped = sum(1 for ward_id in ids if str(ward_id).startswith(f"{body['id']}-w"))
        if mapped:
            town = (body.get("towns") or [body["name"]])[0]
            wards = body.get("wards")
            coverage.append({"body": body["id"], "town": town, "mapped": mapped, "wards": wards})
    return coverage
