"""Verify settings: PUBLIC_BUCKET, where the blurred copies live."""

from pydantic import Field

from agent.settings.base import EnvSettings


class VerifySettings(EnvSettings):
    # Empty is allowed so the app imports in tests; reading an image then fails with ConfigError.
    public_bucket: str = Field(default="", alias="PUBLIC_BUCKET")
