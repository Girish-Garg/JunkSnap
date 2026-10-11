"""Image settings: the size every photo is fitted to before any model sees it."""

from typing import Annotated

from pydantic import Field

from ml.settings.base import EnvSettings

JpegQuality = Annotated[int, Field(ge=1, le=95)]  # Pillow advises 95 at most


class ImageSettings(EnvSettings):
    # Bedrock Converse takes at most 8000 px a side and 3.75 MB; SigLIP reads 224 px.
    max_side_px: int = Field(default=2048, ge=224, le=8000, alias="ML_IMAGE_MAX_SIDE_PX")
    max_bytes: int = Field(default=3_500_000, ge=100_000, le=3_750_000, alias="ML_IMAGE_MAX_BYTES")
    # Tried in order until the JPEG fits; a JSON list such as [90, 80, 70].
    jpeg_qualities: tuple[JpegQuality, ...] = Field(
        default=(90, 80, 70, 60, 50, 40), min_length=1, alias="ML_IMAGE_JPEG_QUALITIES"
    )
