import pytest

from pipeline.domain.errors import ConfigError
from pipeline.settings import Settings


def test_defaults() -> None:
    settings = Settings()

    assert settings.stage == "dev"
    assert settings.aws_region == "ap-south-1"
    assert settings.cors_origins == ("*",)


def test_reads_prefixed_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JUNKSNAP_STAGE", "demo")
    monkeypatch.setenv("JUNKSNAP_CORS_ORIGINS", '["https://a.example", "https://b.example"]')

    settings = Settings.load()

    assert settings.stage == "demo"
    assert settings.cors_origins == ("https://a.example", "https://b.example")


def test_bad_value_raises_config_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JUNKSNAP_CORS_ORIGINS", "not json")

    with pytest.raises(ConfigError):
        Settings.load()
