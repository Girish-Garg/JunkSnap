"""ImageFitter with Pillow: longest side and byte size within Rekognition and Bedrock limits."""

from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

from ml.domain.errors import InvalidImageError
from ml.domain.images import BlurredImage
from ml.ports.image_fitter import ImageFitter

MAX_SIDE = 2048  # ML_IMAGE_MAX_SIDE_PX
MAX_BYTES = 3_500_000  # ML_IMAGE_MAX_BYTES
JPEG_QUALITIES = (90, 80, 70, 60, 50, 40)  # ML_IMAGE_JPEG_QUALITIES, tried in order
SENDABLE_FORMATS = ("JPEG", "PNG")


class PillowImageFitter(ImageFitter):
    def __init__(
        self,
        max_side: int = MAX_SIDE,
        max_bytes: int = MAX_BYTES,
        qualities: tuple[int, ...] = JPEG_QUALITIES,
    ) -> None:
        self._max_side = max_side
        self._max_bytes = max_bytes
        self._qualities = qualities

    def fit(self, image: BlurredImage) -> BlurredImage:
        try:
            with Image.open(BytesIO(image.data)) as picture:
                if self._fits(picture, len(image.data)):
                    return image
                return BlurredImage(image.source, self._shrink(picture))
        except (UnidentifiedImageError, Image.DecompressionBombError, OSError) as error:
            raise InvalidImageError(f"not a usable image: {image.source}") from error

    def _fits(self, picture: Image.Image, size: int) -> bool:
        return (
            picture.format in SENDABLE_FORMATS
            and max(picture.size) <= self._max_side
            and size < self._max_bytes
        )

    def _shrink(self, picture: Image.Image) -> bytes:
        rgb = ImageOps.exif_transpose(picture).convert("RGB")
        rgb.thumbnail((self._max_side, self._max_side))
        for quality in self._qualities:
            buffer = BytesIO()
            rgb.save(buffer, format="JPEG", quality=quality)
            if buffer.tell() < self._max_bytes:
                return buffer.getvalue()
        raise InvalidImageError(f"still over {self._max_bytes} bytes at the lowest JPEG quality")
