"""Blurred images: the only kind of image any model in this package may see."""

from dataclasses import dataclass, field
from typing import Literal

from ml.domain.errors import InvalidImageError, NotBlurredImageError

BLURRED_PREFIX = "media/"

ImageFormat = Literal["jpeg", "png", "gif", "webp"]
_MAGIC_FORMATS: tuple[tuple[bytes, ImageFormat], ...] = (
    (b"\xff\xd8\xff", "jpeg"),
    (b"\x89PNG", "png"),
    (b"GIF8", "gif"),
)


@dataclass(frozen=True)
class BlurredImage:
    source: str
    data: bytes = field(repr=False)

    def __post_init__(self) -> None:
        if not self.source.startswith(BLURRED_PREFIX):
            raise NotBlurredImageError(f"refusing image outside {BLURRED_PREFIX}: {self.source}")
        if not self.data:
            raise InvalidImageError(f"empty image: {self.source}")

    @property
    def format(self) -> ImageFormat:
        for magic, name in _MAGIC_FORMATS:
            if self.data.startswith(magic):
                return name
        if self.data[8:12] == b"WEBP":
            return "webp"
        raise InvalidImageError(f"unsupported image format: {self.source}")

    @property
    def mime_type(self) -> str:
        return f"image/{self.format}"
