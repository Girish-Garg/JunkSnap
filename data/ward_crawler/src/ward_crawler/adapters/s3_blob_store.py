"""Keys under crawl/ in the private originals bucket (SSE-KMS by bucket default)."""

from typing import TYPE_CHECKING

from botocore.exceptions import BotoCoreError, ClientError

from ward_crawler.domain.errors import StoreError
from ward_crawler.ports.blob_store import BlobStore

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client

MISSING = {"NoSuchKey", "404", "NotFound"}


class S3BlobStore(BlobStore):
    def __init__(self, client: "S3Client", bucket: str, prefix: str = "crawl/") -> None:
        self._client = client
        self._bucket = bucket
        self._prefix = prefix

    def get(self, key: str) -> bytes | None:
        try:
            answer = self._client.get_object(Bucket=self._bucket, Key=self._prefix + key)
            return answer["Body"].read()
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") in MISSING:
                return None
            raise StoreError(f"cannot read {self.where(key)}: {error}") from error
        except BotoCoreError as error:
            raise StoreError(f"cannot read {self.where(key)}: {error}") from error

    def put(self, key: str, data: bytes, content_type: str) -> None:
        try:
            self._client.put_object(
                Bucket=self._bucket, Key=self._prefix + key, Body=data, ContentType=content_type
            )
        except (ClientError, BotoCoreError) as error:
            raise StoreError(f"cannot write {self.where(key)}: {error}") from error

    def where(self, key: str) -> str:
        return f"s3://{self._bucket}/{self._prefix}{key}"
