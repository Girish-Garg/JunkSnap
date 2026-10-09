"""Test-only BlurredImageStore: serves local photos the caller vouches are already blurred."""

from collections.abc import Mapping
from pathlib import Path

from ml.domain.errors import ExternalServiceError, NotBlurredImageError
from ml.domain.images import BLURRED_PREFIX, BlurredImage
from ml.ports.image_store import BlurredImageStore

LOCAL_KEY_PREFIX = f"{BLURRED_PREFIX}local-test/"


class LocalBlurredImageStore(BlurredImageStore):
    def __init__(self, files: Mapping[str, Path]) -> None:
        self._files = dict(files)

    @staticmethod
    def key_for(index: int, path: Path) -> str:
        return f"{LOCAL_KEY_PREFIX}{index:02d}_{path.name}"

    def read(self, key: str) -> BlurredImage:
        path = self._files.get(key)
        if path is None:
            raise NotBlurredImageError(f"no vouched local photo for {key}")
        try:
            return BlurredImage(key, path.read_bytes())
        except OSError as error:
            raise ExternalServiceError(f"cannot read {path.name}: {error}") from error
