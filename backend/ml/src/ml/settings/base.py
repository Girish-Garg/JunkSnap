"""Base class for every settings class in the package, and the bounded types they share."""

from typing import Annotated, Self

from pydantic import Field, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict, SettingsError

from ml.domain.errors import ConfigError

Probability = Annotated[float, Field(ge=0.0, le=1.0)]
Seconds = Annotated[float, Field(gt=0.0, le=600.0)]
Attempts = Annotated[int, Field(ge=1, le=10)]  # the first call included


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
