"""ModelStore over the private bucket's `models/` prefix: download once, verify the SHA-256."""

from pathlib import Path
from typing import TYPE_CHECKING

from botocore.exceptions import BotoCoreError, ClientError

from ml.domain.errors import ConfigError, ExternalServiceError
from ml.domain.model_files import PinnedModel
from ml.ports.model_store import ModelStore

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client


class S3ModelStore(ModelStore):
    def __init__(self, client: "S3Client", bucket: str, folder: Path) -> None:
        self._client = client
        self._bucket = bucket
        self._folder = folder

    def fetch(self, model: PinnedModel) -> Path:
        local = self._folder / model.key
        if model.matches(local):
            return local
        if not self._bucket:
            raise ConfigError("ORIGINALS_BUCKET is not set, so models cannot be downloaded")
        partial = local.with_name(f"{local.name}.part")
        partial.parent.mkdir(parents=True, exist_ok=True)
        try:
            self._client.download_file(self._bucket, model.key, str(partial))
        except (BotoCoreError, ClientError) as error:
            raise ExternalServiceError(f"download {model.key}: {error}") from error
        if not model.matches(partial):
            partial.unlink(missing_ok=True)
            raise ConfigError(f"{model.key} does not match its pinned SHA-256")
        partial.replace(local)
        return local
