"""Tests for scripts/check_config.py: the docs and example parsers and the comparison.

Run with: uv run --with pytest pytest scripts/tests -q
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from check_config import (  # noqa: E402
    compare,
    documented_defaults,
    example_defaults,
    listed_problems,
    mirror_problems,
    same_value,
)
from config_values import ZERO_OK  # noqa: E402
from stage_config import ConfigError  # noqa: E402

README = """
## Environment variables

| Variable | Used by | Value |
|---|---|---|
| `JUNKSNAP_STAGE` | api | `dev` or `demo` |
| `SNAP_PER_HOUR` | api, worker | `20`: Snap photos per hour |
| `AREA_LIST_DEFAULT_LIMIT`, `AREA_LIST_MAX_LIMIT` | api | `50` and `200`, each at most 200 |
| `CLEANED_QUORUM` | api | `3`, at least 3 (the site contract's `clearance.needed`) |
| `ML_WEIGHT_YOLO`, `ML_WEIGHT_VISION_JUDGE` | ml | (`fw-v0`) weights `0.3` and `0.6` |
| `ML_IMAGE_JPEG_QUALITIES` | ml | a JSON list, `[90, 80, 70]` (each 1 to 95) |
| `ML_OFFLINE_RETRIES` | ml offline scoring (local, not a workload) | `8` retries |
| `UVICORN_HOST`, `UVICORN_PORT` | ml | set in the image: `0.0.0.0` and `8000` |
| `VITE_API_URL` | frontend | `https://example` |

## Stages and names

| `NOT_IN_THE_TABLE` | api | `1` |
"""


def test_documented_defaults_read_numbers_in_order_and_skip_wiring() -> None:
    assert documented_defaults(README) == {
        "SNAP_PER_HOUR": "20",
        "AREA_LIST_DEFAULT_LIMIT": "50",
        "AREA_LIST_MAX_LIMIT": "200",
        "CLEANED_QUORUM": "3",
        "ML_WEIGHT_YOLO": "0.3",
        "ML_WEIGHT_VISION_JUDGE": "0.6",
        "ML_IMAGE_JPEG_QUALITIES": "[90, 80, 70]",
    }


def test_a_row_with_too_few_defaults_is_an_error() -> None:
    readme = README.replace("`50` and `200`", "`50` and two hundred")
    with pytest.raises(ConfigError, match="AREA_LIST_DEFAULT_LIMIT"):
        documented_defaults(readme)


def test_example_defaults_read_set_and_commented_lines_without_endpoints() -> None:
    example = (
        "# Copy to .env.local.\nVITE_API_MODE=mock\nVITE_API_URL=\n"
        "# Votes count within this many metres [VOTE_RADIUS_M].\n# VITE_VOTE_RADIUS_M=1000\n"
        "# VITE_PILOT_CENTRE=73.02,26.27\nVITE_TOAST_MS=4500\n"
        "# Keep it under VITE_CAPTURE_FIX_MAX_AGE_MS=10000 please.\n"
    )
    assert example_defaults(example) == {
        "VITE_VOTE_RADIUS_M": "1000",
        "VITE_PILOT_CENTRE": "73.02,26.27",
        "VITE_TOAST_MS": "4500",
    }


@pytest.mark.parametrize("left, right, same", [
    ("0.10", "0.1", True), ("8", "8.0", True), ("0", "0.0", True), ("3", "4", False),
    ("[90,80]", "[90, 80]", True), ("[90,80]", "[80,90]", False),
    ("73.02,26.27", "73.02,26.27", True), ("boundaries/", "boundaries", False),
])
def test_same_value(left: str, right: str, same: bool) -> None:
    assert same_value(left, right) is same


def test_compare_names_missing_extra_and_different_keys() -> None:
    problems = compare({"A": "1", "B": "2"}, {"B": "3", "C": "4"}, "docs")
    assert problems == [
        "config/defaults.env: A is missing (docs default 1)",
        "config/defaults.env: C is not in docs",
        "config/defaults.env: B=3 but docs says 2",
    ]


def test_mirror_problems_catch_a_frontend_value_out_of_step() -> None:
    defaults = {"VOTE_RADIUS_M": "1000", "VITE_VOTE_RADIUS_M": "900",
                "SCAN_MAX_MB": "40", "VITE_SCAN_MAX_BYTES": "41943040"}
    problems = mirror_problems(defaults)
    assert "config/defaults.env: VITE_VOTE_RADIUS_M=900 does not follow VOTE_RADIUS_M=1000" \
        in problems
    assert not [p for p in problems if "VITE_SCAN_MAX_BYTES=" in p]
    assert [p for p in problems if "FLAG_RADIUS_M -> VITE_FLAG_RADIUS_M needs both" in p]


def test_listed_problems_catch_stale_names_in_the_loader() -> None:
    defaults = {key: "1" for key in ZERO_OK} | {"VITE_ZONE_RADIUS_M": "1000"}
    assert listed_problems(defaults) == []
    defaults["SITE_SAME_SPOT_M"] = "0"
    del defaults["VITE_ZONE_RADIUS_M"]
    assert listed_problems(defaults) == [
        "config_values.py: ZERO_OK names SITE_SAME_SPOT_M, not a server or ml tunable above 0",
        "stage_config.py: FIXED names VITE_ZONE_RADIUS_M, not in config/defaults.env",
    ]
