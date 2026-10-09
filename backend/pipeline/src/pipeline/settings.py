"""Typed configuration, read once from JUNKSNAP_* environment variables."""

from typing import Self

from pydantic import ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict, SettingsError

from pipeline.domain.errors import ConfigError


class Settings(BaseSettings):
    """Immutable settings passed by constructor to whatever needs them."""

    model_config = SettingsConfigDict(env_prefix="JUNKSNAP_", frozen=True)

    stage: str = "dev"
    aws_region: str = "ap-south-1"
    cors_origins: tuple[str, ...] = ("*",)

    @classmethod
    def load(cls) -> Self:
        """Read the environment, turning any bad value into a ConfigError."""
        try:
            return cls()
        except (ValidationError, SettingsError) as error:
            raise ConfigError(str(error)) from error
