"""Tests for scripts/android_stage.py and the per-build Tauri config in build_android.py.

Run with: uv run --with pytest pytest scripts/tests -q
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from android_stage import ENV_NAMES, StageSettings  # noqa: E402
from build_android import StageConfig  # noqa: E402

VALUES = {
    "VITE_API_URL": "https://d111111abcdef8.cloudfront.net/",
    "VITE_COGNITO_USER_POOL_ID": "ap-south-1_Example",
    "VITE_COGNITO_CLIENT_ID": "exampleclientid",
    "VITE_WEB_URL": "https://demo.example.amplifyapp.com/",
    "JUNKSNAP_UPLOADS_BUCKET": "junksnap-demo-originals-000000000000",
}


def test_env_settings_give_the_vite_env_and_csp_hosts(monkeypatch: pytest.MonkeyPatch) -> None:
    for name, value in VALUES.items():
        monkeypatch.setenv(name, value)
    settings = StageSettings.from_env()
    assert settings.vite_env() == {
        "VITE_API_MODE": "live",
        "VITE_API_URL": "https://d111111abcdef8.cloudfront.net",
        "VITE_COGNITO_USER_POOL_ID": "ap-south-1_Example",
        "VITE_COGNITO_CLIENT_ID": "exampleclientid",
        "VITE_WEB_URL": "https://demo.example.amplifyapp.com",
    }
    assert settings.csp_sources() == (
        "https://d111111abcdef8.cloudfront.net",
        "https://junksnap-demo-originals-000000000000.s3.ap-south-1.amazonaws.com",
    )


def test_missing_env_vars_are_named(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ENV_NAMES.values():
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("VITE_API_URL", VALUES["VITE_API_URL"])
    with pytest.raises(SystemExit, match="VITE_WEB_URL"):
        StageSettings.from_env()


def test_stage_config_adds_hosts_to_the_csp_and_sets_the_version() -> None:
    settings = StageSettings("https://api.example", "pool", "client", "https://web.example", "b")
    config = StageConfig(settings, "1.2.3").config()
    csp = config["app"]["security"]["csp"]  # type: ignore[index]
    assert "https://api.example" in csp["connect-src"]
    assert "https://b.s3.ap-south-1.amazonaws.com" in csp["connect-src"]
    assert "https://api.example" in csp["img-src"]
    assert config["version"] == "1.2.3"
    assert "version" not in StageConfig(settings, None).config()
