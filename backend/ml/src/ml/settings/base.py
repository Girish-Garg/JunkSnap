"""Base class for every settings class in the package."""

from typing import Self

from pydantic import ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict, SettingsError

from ml.domain.errors import ConfigError


class EnvSettings(BaseSettings):
    """Frozen settings read from environment variables. Each field names its variable by alias."""

    model_config = SettingsConfigDict(frozen=True)

    @classmethod
    def load(cls) -> Self:
        """Read the environment, turning any missing or bad value into a ConfigError."""
        try:
            return cls()
        except (ValidationError, SettingsError) as error:
            raise ConfigError(str(error)) from error
