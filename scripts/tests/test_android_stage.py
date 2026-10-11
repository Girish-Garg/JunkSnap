"""Tests for scripts/android_stage.py and the per-build Tauri config in build_android.py.

Run with: uv run --with pytest pytest scripts/tests -q
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import build_android  # noqa: E402
import stage_config  # noqa: E402
from android_stage import ENV_NAMES, StageSettings  # noqa: E402
from build_android import AndroidBuild, StageConfig, without_signing  # noqa: E402

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
    monkeypatch.setenv("VITE_SHARE_URL", "https://junksnap.example/")
    settings = StageSettings.from_env()
    assert settings.vite_env() == {
        "VITE_API_MODE": "live",
        "VITE_API_URL": "https://d111111abcdef8.cloudfront.net",
        "VITE_COGNITO_USER_POOL_ID": "ap-south-1_Example",
        "VITE_COGNITO_CLIENT_ID": "exampleclientid",
        "VITE_WEB_URL": "https://demo.example.amplifyapp.com",
        "VITE_SHARE_URL": "https://junksnap.example",
    }
    assert settings.csp_sources() == (
        "https://d111111abcdef8.cloudfront.net",
        "https://junksnap-demo-originals-000000000000.s3.ap-south-1.amazonaws.com",
    )


def test_share_url_is_optional_and_blank_means_the_api(monkeypatch: pytest.MonkeyPatch) -> None:
    for name, value in VALUES.items():
        monkeypatch.setenv(name, value)
    monkeypatch.delenv("VITE_SHARE_URL", raising=False)
    assert StageSettings.from_env().vite_env()["VITE_SHARE_URL"] == ""


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


def test_signing_variables_stay_out_of_npm_steps() -> None:
    env = {
        "PATH": "/bin",
        "ANDROID_HOME": "/sdk",
        "ANDROID_KEYSTORE_PATH": "/tmp/k.jks",
        "ANDROID_KEYSTORE_PASSWORD": "x",
        "ANDROID_KEY_ALIAS": "a",
        "ANDROID_KEY_PASSWORD": "y",
    }
    assert without_signing(env) == {"PATH": "/bin", "ANDROID_HOME": "/sdk"}


def test_web_build_gets_the_stage_tunables_and_keeps_its_endpoints(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    envs: list[dict[str, str]] = []
    monkeypatch.setattr(build_android, "stream", lambda args, cwd, env: envs.append(env))
    monkeypatch.setattr(build_android, "STAGE_MARK", tmp_path / ".stage")
    tunables = {**stage_config.load("demo").vite, "VITE_API_URL": "https://from-config.example",
                "VITE_SHARE_URL": "https://from-config.example"}
    settings = StageSettings("https://api.example", "pool", "client", "https://web.example", "b",
                             "https://share.example/")
    shell = {"PATH": "/bin", "VITE_SHARE_URL": "https://from-shell.example"}
    AndroidBuild("demo", shell).web(settings, tunables)

    assert envs, "npm ci and npm run build ran"
    for env in envs:
        assert env["VITE_VOTE_RADIUS_M"] == "1000"
        assert env["VITE_SCAN_MAX_BYTES"] == str(40 * 1_048_576)
        assert env["VITE_API_URL"] == "https://api.example"
        assert env["VITE_SHARE_URL"] == "https://share.example"
    assert (tmp_path / ".stage").read_text() == "demo"
