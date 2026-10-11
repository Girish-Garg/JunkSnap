"""Base class for every settings class in the package, and the bounded types they share."""

from typing import Annotated, Self

from pydantic import Field, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict, SettingsError

from ml.domain.errors import ConfigError

Probability = Annotated[float, Field(ge=0.0, le=1.0, allow_inf_nan=False)]
Seconds = Annotated[float, Field(gt=0.0, le=600.0, allow_inf_nan=False)]
Weight = Annotated[float, Field(ge=0.0, le=100.0, allow_inf_nan=False)]  # relative, fixed weights
Attempts = Annotated[int, Field(ge=1, le=10)]  # the first call included


class EnvSettings(BaseSettings):
    """Frozen settings read from environment variables. Each field names its variable by alias."""

    # An empty value stays an error here: an empty JUNKSNAP_STAGE or LLM_TASKS must not
    # quietly become dev or the default judge order.
    model_config = SettingsConfigDict(frozen=True)

    @classmethod
    def load(cls) -> Self:
        """Read the environment, turning any missing or bad value into a ConfigError."""
        try:
            return cls()
        except (ValidationError, SettingsError) as error:
            raise ConfigError(str(error)) from error


class TunableSettings(EnvSettings):
    """The ML_* tuning variables: an empty value means unset, and a float must be finite."""

    model_config = SettingsConfigDict(frozen=True, env_ignore_empty=True, allow_inf_nan=False)
