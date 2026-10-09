import pytest

from ml.domain.errors import ConfigError
from ml.settings.core import CoreSettings


def test_defaults_are_for_dev() -> None:
    settings = CoreSettings.load()

    assert settings.stage == "dev"
    assert settings.aws_region == "ap-south-1"


def test_reads_exact_variable_names(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JUNKSNAP_STAGE", "demo")
    monkeypatch.setenv("AWS_REGION", "us-east-1")

    settings = CoreSettings.load()

    assert settings.stage == "demo"
    assert settings.aws_region == "us-east-1"


def test_demo_starts_without_cors_origins(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JUNKSNAP_STAGE", "demo")

    assert CoreSettings.load().stage == "demo"


def test_unknown_stage_raises_config_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JUNKSNAP_STAGE", "prod")

    with pytest.raises(ConfigError):
        CoreSettings.load()
