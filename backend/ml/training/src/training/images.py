"""Re-encodes downloaded images to upright RGB JPEG with a bounded long side."""

from __future__ import annotations

import io
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from training.domain import ExternalServiceError
from training.ports import ImageWriter

MAX_SIDE = 1280
QUALITY = 88


class ImageNormaliser(ImageWriter):
    def __init__(self, max_side: int = MAX_SIDE) -> None:
        self._max_side = max_side

    def write(self, data: bytes, dest: Path) -> None:
        """Boxes are fractions of the upright image, so resizing keeps them valid."""
        try:
            with Image.open(io.BytesIO(data)) as raw:
                image = ImageOps.exif_transpose(raw).convert("RGB")
        except (UnidentifiedImageError, OSError) as error:
            raise ExternalServiceError(f"unreadable image for {dest.name}: {error}") from error
        image.thumbnail((self._max_side, self._max_side))
        dest.parent.mkdir(parents=True, exist_ok=True)
        image.save(dest, "JPEG", quality=QUALITY)
