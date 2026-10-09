"""Settings every workload needs: stage, AWS region and allowed browser origins."""

from typing import Literal

from pydantic import Field

from pipeline.domain.errors import ConfigError
from pipeline.settings.base import EnvSettings


class CoreSettings(EnvSettings):
    """JUNKSNAP_STAGE, AWS_REGION and CORS_ORIGINS. Task settings live in their own classes."""

    stage: Literal["dev", "demo"] = Field(default="dev", alias="JUNKSNAP_STAGE")
    aws_region: str = Field(default="ap-south-1", alias="AWS_REGION")
    cors_origins: str = Field(default="", alias="CORS_ORIGINS")

    def allowed_origins(self) -> tuple[str, ...]:
        """Origins from comma-separated CORS_ORIGINS. Only the dev stage falls back to "*"."""
        origins = tuple(part.strip() for part in self.cors_origins.split(",") if part.strip())
        if origins:
            return origins
        if self.stage == "dev":
            return ("*",)
        raise ConfigError(f"CORS_ORIGINS must be set in the {self.stage} stage")
