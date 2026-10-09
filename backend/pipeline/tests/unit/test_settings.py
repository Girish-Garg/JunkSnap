import pytest

from pipeline.domain.errors import ConfigError
from pipeline.settings.core import CoreSettings


def test_defaults_are_for_dev() -> None:
    settings = CoreSettings.load()

    assert settings.stage == "dev"
    assert settings.aws_region == "ap-south-1"
    assert settings.allowed_origins() == ("*",)


def test_reads_exact_variable_names(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JUNKSNAP_STAGE", "demo")
    monkeypatch.setenv("AWS_REGION", "us-east-1")
    monkeypatch.setenv("CORS_ORIGINS", "https://a.example,http://localhost:5173")

    settings = CoreSettings.load()

    assert settings.stage == "demo"
    assert settings.aws_region == "us-east-1"
    assert settings.allowed_origins() == ("https://a.example", "http://localhost:5173")


def test_unknown_stage_raises_config_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JUNKSNAP_STAGE", "prod")

    with pytest.raises(ConfigError):
        CoreSettings.load()


def test_no_wildcard_origin_outside_dev(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JUNKSNAP_STAGE", "demo")

    with pytest.raises(ConfigError, match="CORS_ORIGINS"):
        CoreSettings.load().allowed_origins()
