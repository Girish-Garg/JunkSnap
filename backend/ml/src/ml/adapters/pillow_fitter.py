"""ImageFitter with Pillow: longest side and byte size within Rekognition and Bedrock limits."""

from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

from ml.domain.errors import InvalidImageError
from ml.domain.images import BlurredImage
from ml.ports.image_fitter import ImageFitter

MAX_SIDE = 2048
MAX_BYTES = 3_500_000
JPEG_QUALITIES = (90, 80, 70, 60, 50, 40)
SENDABLE_FORMATS = ("JPEG", "PNG")


class PillowImageFitter(ImageFitter):
    def fit(self, image: BlurredImage) -> BlurredImage:
        try:
            with Image.open(BytesIO(image.data)) as picture:
                if self._fits(picture, len(image.data)):
                    return image
                return BlurredImage(image.source, self._shrink(picture))
        except (UnidentifiedImageError, Image.DecompressionBombError, OSError) as error:
            raise InvalidImageError(f"not a usable image: {image.source}") from error

    @staticmethod
    def _fits(picture: Image.Image, size: int) -> bool:
        return (
            picture.format in SENDABLE_FORMATS
            and max(picture.size) <= MAX_SIDE
            and size < MAX_BYTES
        )

    @staticmethod
    def _shrink(picture: Image.Image) -> bytes:
        rgb = ImageOps.exif_transpose(picture).convert("RGB")
        rgb.thumbnail((MAX_SIDE, MAX_SIDE))
        for quality in JPEG_QUALITIES:
            buffer = BytesIO()
            rgb.save(buffer, format="JPEG", quality=quality)
            if buffer.tell() < MAX_BYTES:
                return buffer.getvalue()
        raise InvalidImageError(f"still over {MAX_BYTES} bytes at the lowest JPEG quality")
