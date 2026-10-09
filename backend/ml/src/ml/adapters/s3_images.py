"""BlurredImageStore over the public S3 bucket; keys outside media/ are refused."""

from typing import TYPE_CHECKING

from botocore.exceptions import BotoCoreError, ClientError

from ml.domain.errors import ConfigError, ExternalServiceError, NotBlurredImageError
from ml.domain.images import BLURRED_PREFIX, BlurredImage
from ml.ports.image_store import BlurredImageStore

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client


class S3BlurredImageStore(BlurredImageStore):
    def __init__(self, client: "S3Client", bucket: str) -> None:
        self._client = client
        self._bucket = bucket

    def read(self, key: str) -> BlurredImage:
        if not key.startswith(BLURRED_PREFIX):
            raise NotBlurredImageError(f"refusing key outside {BLURRED_PREFIX}: {key}")
        if not self._bucket:
            raise ConfigError("PUBLIC_BUCKET is not set")
        try:
            data = self._client.get_object(Bucket=self._bucket, Key=key)["Body"].read()
        except (BotoCoreError, ClientError) as error:
            raise ExternalServiceError(f"s3 get {key}: {error}") from error
        return BlurredImage(source=key, data=data)
