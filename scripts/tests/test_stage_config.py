"""Tests for scripts/stage_config.py: config/defaults.env plus config/<stage>.env.

Run with: uv run --with pytest pytest scripts/tests -q
"""

import codecs
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import stage_config  # noqa: E402
from stage_config import ConfigError, build, load, looks_secret, parse_env  # noqa: E402

DEFAULTS = """
# server
SNAP_PER_HOUR=20
VOTE_RADIUS_M=1000
SCAN_MAX_SECONDS=60
SCAN_MAX_MB=40
ML_AUTO_VERIFY_MIN=0.85
ML_IMAGE_JPEG_QUALITIES=[90,80,70]
# frontend
VITE_VOTE_RADIUS_M=1000
VITE_SCAN_MAX_DURATION_MS=60000
VITE_SCAN_MAX_BYTES=41943040
VITE_MAP_STYLE_URL=https://tiles.example/styles/positron
VITE_PILOT_CENTRE=73.02,26.27
VITE_PILOT_ZOOM=12.0
VITE_THIN_MAX=2
VITE_ZONE_RADIUS_M=1000
"""


def test_defaults_then_stage_file_split_by_destination() -> None:
    config = build(DEFAULTS, "SNAP_PER_HOUR=100\nML_AUTO_VERIFY_MIN=0.9\n", "demo")
    assert config.configmap["SNAP_PER_HOUR"] == "100"
    assert config.configmap["ML_AUTO_VERIFY_MIN"] == "0.9"
    assert config.configmap["VOTE_RADIUS_M"] == "1000"
    assert all(not key.startswith("VITE_") for key in config.configmap)
    assert config.vite["VITE_MAP_STYLE_URL"] == "https://tiles.example/styles/positron"
    assert all(key.startswith("VITE_") for key in config.vite)
    assert "SNAP_PER_HOUR=100" in config.literals()


def test_a_server_edit_moves_its_frontend_mirror() -> None:
    config = build(DEFAULTS, "VOTE_RADIUS_M=500\nSCAN_MAX_SECONDS=30\nSCAN_MAX_MB=20\n", "dev")
    assert config.configmap["VOTE_RADIUS_M"] == "500"
    assert config.vite["VITE_VOTE_RADIUS_M"] == "500"
    assert config.vite["VITE_SCAN_MAX_DURATION_MS"] == "30000"
    assert config.vite["VITE_SCAN_MAX_BYTES"] == str(20 * 1_048_576)


def test_an_explicit_frontend_value_wins_over_its_mirror() -> None:
    config = build(DEFAULTS, "VOTE_RADIUS_M=500\nVITE_VOTE_RADIUS_M=450\n", "dev")
    assert config.configmap["VOTE_RADIUS_M"] == "500"
    assert config.vite["VITE_VOTE_RADIUS_M"] == "450"


@pytest.mark.parametrize("value, message", [
    ("forty", "SCAN_MAX_MB='forty' is not a number"),
    ("Infinity", "SCAN_MAX_MB='Infinity' is not a number"),
    ("0.0000001", "makes VITE_SCAN_MAX_BYTES a fraction"),
])
def test_a_scaled_mirror_needs_a_number(value: str, message: str) -> None:
    mirror = next(m for m in stage_config.MIRRORS if m.server == "SCAN_MAX_MB")
    with pytest.raises(ConfigError, match=message):
        mirror.value(value)


@pytest.mark.parametrize("line, message", [
    ("SNAP_PER_HOUR=abc", "config/demo.env:2: SNAP_PER_HOUR='abc' needs a whole number like the "
                          "default 20"),
    ("SNAP_PER_HOUR=1.5", "SNAP_PER_HOUR='1.5' needs a whole number"),
    ("SNAP_PER_HOUR=-1", "SNAP_PER_HOUR='-1' must not be below 0"),
    ("SNAP_PER_HOUR=0", "SNAP_PER_HOUR='0' must be above 0"),
    ("SNAP_PER_HOUR=", "SNAP_PER_HOUR='' needs a whole number"),
    ("SNAP_PER_HOUR=1e3", "needs a whole number"),
    ("ML_AUTO_VERIFY_MIN=high", "ML_AUTO_VERIFY_MIN='high' needs a plain number like the default "
                                "0.85"),
    ("ML_AUTO_VERIFY_MIN=-0.1", "must not be below 0"),
    ("ML_IMAGE_JPEG_QUALITIES=90,80", "needs a non-empty JSON list of whole numbers"),
    ("ML_IMAGE_JPEG_QUALITIES=[]", "needs a non-empty JSON list"),
    ("ML_IMAGE_JPEG_QUALITIES=[90.5]", "needs a non-empty JSON list of whole numbers"),
    ("VITE_PILOT_CENTRE=73.02", "needs 2 comma-separated numbers like the default 73.02,26.27"),
    ("VITE_PILOT_CENTRE=east,north", "needs 2 comma-separated numbers"),
    ("VITE_ZONE_RADIUS_M=900", "VITE_ZONE_RADIUS_M cannot change: the server's no-bin zone radius"),
])
def test_bad_values_stop_the_load_and_name_file_line_and_key(line: str, message: str) -> None:
    with pytest.raises(ConfigError, match=re.escape(message)):
        build(DEFAULTS, f"# demo\n{line}\n", "demo")


@pytest.mark.parametrize("line", [
    "SNAP_PER_HOUR=100", "ML_AUTO_VERIFY_MIN=0.9", "ML_AUTO_VERIFY_MIN=1", "ML_AUTO_VERIFY_MIN=0",
    "ML_IMAGE_JPEG_QUALITIES=[85, 70]", "VITE_PILOT_CENTRE=73.1, 26.3", "VITE_PILOT_ZOOM=12.5",
    "VITE_THIN_MAX=0", "VITE_MAP_STYLE_URL=https://tiles.example/styles/bright",
])
def test_good_values_load(line: str) -> None:
    build(DEFAULTS, line, "demo")


def test_every_problem_in_a_stage_file_is_listed_at_once() -> None:
    with pytest.raises(ConfigError) as error:
        build(DEFAULTS, "SNAP_PER_HOUR=abc\nSNAP_PER_HOURS=5\n", "demo")
    assert "config/demo.env:1: SNAP_PER_HOUR='abc'" in str(error.value)
    assert "config/demo.env:2: SNAP_PER_HOURS is not a tunable" in str(error.value)


def test_unknown_keys_in_a_stage_file_are_refused() -> None:
    with pytest.raises(ConfigError, match="SNAP_PER_HOURS is not a tunable"):
        build(DEFAULTS, "SNAP_PER_HOURS=100\n", "demo")


@pytest.mark.parametrize("key", ["OPENAI_API_KEY", "AWS_SECRET_ACCESS_KEY", "GITHUB_TOKEN",
                                 "DB_PASSWORD", "CLIENT_SECRET", "VITE_MAPS_KEY"])
def test_secret_looking_keys_are_refused_even_in_defaults(key: str) -> None:
    assert looks_secret(key)
    with pytest.raises(ConfigError, match="looks like a secret"):
        build(DEFAULTS + f"{key}=x\n", "", "dev")


@pytest.mark.parametrize("key", ["OPENAI_SECRET_ID", "AWS_ACCESS_KEY_ID", "SECRET_TIMEOUT_MS",
                                 "LETTER_MAX_TOKENS", "ML_JUDGE_MAX_TOKENS", "COGNITO_CLIENT_ID"])
def test_ids_and_numbers_are_not_secrets(key: str) -> None:
    assert not looks_secret(key)


def test_endpoint_values_stay_with_the_deploy_scripts() -> None:
    with pytest.raises(ConfigError, match="VITE_API_URL is set by the deploy scripts"):
        build(DEFAULTS, "VITE_API_URL=https://example.org\n", "dev")


@pytest.mark.parametrize("value", ["https://downloads.example/junksnap.apk", ""])
def test_a_stage_may_move_or_hide_the_android_app_link(value: str) -> None:
    """Not an endpoint: a stage file may point the desktop dialog's app link elsewhere, or blank it."""
    assert "VITE_ANDROID_APP_URL" not in stage_config.ENDPOINT_KEYS
    defaults = (stage_config.CONFIG_DIR / "defaults.env").read_text(encoding="utf-8")
    config = build(defaults, f"VITE_ANDROID_APP_URL={value}\n", "demo")
    assert config.vite["VITE_ANDROID_APP_URL"] == value


@pytest.mark.parametrize("line, message", [
    ("SNAP_PER_HOUR 100", "expected KEY=value"),
    ("export SNAP_PER_HOUR=100", "expected KEY=value"),
    ("SNAP_PER_HOUR=100 # field days", "comment on its own line"),
    ('SNAP_PER_HOUR="100"', "without quotes"),
    ("SNAP_PER_HOUR=1\nSNAP_PER_HOUR=2", "set twice"),
])
def test_malformed_lines_name_the_file_and_line(line: str, message: str) -> None:
    with pytest.raises(ConfigError, match=message):
        parse_env(line, "config/demo.env")


def test_blank_values_comments_and_equals_signs_in_values_parse() -> None:
    text = "# note\n\nA_B=\nVITE_X=a=b,c\n  C=7  \n"
    assert parse_env(text, "x") == {"A_B": "", "VITE_X": "a=b,c", "C": "7"}


def test_load_reads_both_files_and_needs_the_stage_file(tmp_path: Path) -> None:
    (tmp_path / "defaults.env").write_text(DEFAULTS, encoding="utf-8")
    (tmp_path / "demo.env").write_text("SNAP_PER_HOUR=100\n", encoding="utf-8")
    assert load("demo", tmp_path).configmap["SNAP_PER_HOUR"] == "100"
    with pytest.raises(ConfigError, match="missing"):
        load("dev", tmp_path)
    with pytest.raises(ConfigError, match="unknown stage"):
        load("prod", tmp_path)


@pytest.mark.parametrize("stage", stage_config.STAGES)
def test_the_committed_config_loads_with_every_mirror_in_step(stage: str) -> None:
    config = load(stage)
    values = {**config.configmap, **config.vite}
    for mirror in stage_config.MIRRORS:
        assert values[mirror.vite] == mirror.value(values[mirror.server])


def test_the_committed_demo_config_keeps_the_field_audit_rate() -> None:
    assert load("demo").configmap["SNAP_PER_HOUR"] == "100"
    assert load("dev").configmap["SNAP_PER_HOUR"] == "20"
    assert load("demo").summary().endswith("overrides: SNAP_PER_HOUR=100")
    assert load("dev").summary().endswith("overrides: none")


def test_load_or_exit_stops_on_a_config_error(tmp_path: Path) -> None:
    (tmp_path / "defaults.env").write_text(DEFAULTS, encoding="utf-8")
    (tmp_path / "dev.env").write_text("SNAP_PER_HOUR_TYPO=1\n", encoding="utf-8")
    with pytest.raises(SystemExit, match="config error: config/dev.env:1: SNAP_PER_HOUR_TYPO"):
        stage_config.load_or_exit("dev", tmp_path)


@pytest.mark.parametrize("data, message", [
    (codecs.BOM_UTF8 + b"SNAP_PER_HOUR=100\n", "config/dev.env starts with a byte order mark"),
    ("SNAP_PER_HOUR=100\n".encode("utf-16"), "config/dev.env is UTF-16"),
    ("SNAP_PER_HOUR=100\n".encode("utf-16-le"), "config/dev.env has NUL bytes"),
    (b"SNAP_PER_HOUR=100\n# caf\xe9\n", "config/dev.env is not UTF-8 (byte 23)"),
])
def test_a_file_that_is_not_plain_utf8_is_refused(tmp_path: Path, data: bytes,
                                                  message: str) -> None:
    (tmp_path / "defaults.env").write_text(DEFAULTS, encoding="utf-8")
    (tmp_path / "dev.env").write_bytes(data)
    with pytest.raises(ConfigError, match=re.escape(message)):
        load("dev", tmp_path)
