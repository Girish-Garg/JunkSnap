"""Settings every workload needs: JUNKSNAP_STAGE and AWS_REGION (ml is internal, so no CORS)."""

from typing import Literal

from pydantic import Field

from ml.settings.base import EnvSettings


class CoreSettings(EnvSettings):
    stage: Literal["dev", "demo"] = Field(default="dev", alias="JUNKSNAP_STAGE")
    aws_region: str = Field(default="ap-south-1", alias="AWS_REGION")
