"""EmbeddingSink over the private bucket: the only prefix ml writes (`embeddings/`)."""

import json
from typing import TYPE_CHECKING

from botocore.exceptions import BotoCoreError, ClientError

from ml.domain.embedding import Embedding
from ml.domain.errors import ConfigError, ExternalServiceError
from ml.ports.embedding_sink import EmbeddingSink

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client

PREFIX = "embeddings/"


class S3EmbeddingSink(EmbeddingSink):
    def __init__(self, client: "S3Client", bucket: str) -> None:
        self._client = client
        self._bucket = bucket

    def store(self, case_id: str, embedding: Embedding) -> str:
        if not self._bucket:
            raise ConfigError("ORIGINALS_BUCKET is not set, so embeddings cannot be stored")
        key = f"{PREFIX}{case_id}.json"
        body = json.dumps(embedding.to_contract()).encode("utf-8")
        try:
            self._client.put_object(
                Bucket=self._bucket, Key=key, Body=body, ContentType="application/json"
            )
        except (BotoCoreError, ClientError) as error:
            raise ExternalServiceError(f"store {key}: {error}") from error
        return key
