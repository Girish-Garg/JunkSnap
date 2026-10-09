"""HTTP and AWS adapters."""

from __future__ import annotations

import json
import shutil
import time
import urllib.request
from collections.abc import Callable
from pathlib import Path
from typing import TYPE_CHECKING, Any, override

from botocore.exceptions import BotoCoreError, ClientError

from training.domain import ExternalServiceError
from training.ports import Downloader, ObjectStore

if TYPE_CHECKING:
    from mypy_boto3_cloudformation import CloudFormationClient
    from mypy_boto3_s3 import S3Client

USER_AGENT = "junksnap-training/0.1 (dataset fetch)"
ATTEMPTS = 3


class HttpDownloader(Downloader):
    def download(self, url: str, dest: Path) -> None:
        dest.parent.mkdir(parents=True, exist_ok=True)
        partial = dest.with_suffix(dest.suffix + ".part")
        self._retry(lambda: self._copy(url, partial))
        partial.replace(dest)

    def get_json(self, url: str) -> Any:
        return json.loads(self._retry(lambda: self._read(url)))

    @staticmethod
    def _open(url: str) -> Any:
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        return urllib.request.urlopen(request, timeout=120)

    def _copy(self, url: str, dest: Path) -> bytes:
        with self._open(url) as response, dest.open("wb") as out:
            shutil.copyfileobj(response, out, 1 << 20)
        return b""

    def _read(self, url: str) -> bytes:
        with self._open(url) as response:
            data: bytes = response.read()
            return data

    @staticmethod
    def _retry(action: Callable[[], bytes]) -> bytes:
        for attempt in range(ATTEMPTS):
            try:
                return action()
            except OSError as error:
                if attempt == ATTEMPTS - 1:
                    raise ExternalServiceError(f"download failed: {error}") from error
                time.sleep(2**attempt)
        raise ExternalServiceError("unreachable")


class S3ObjectStore(ObjectStore):
    def __init__(self, client: S3Client, bucket: str) -> None:
        self._client = client
        self._bucket = bucket

    def upload_file(self, local: Path, key: str) -> None:
        try:
            self._client.upload_file(str(local), self._bucket, key)
        except (BotoCoreError, ClientError) as error:
            raise ExternalServiceError(f"s3 upload {key}: {error}") from error

    @property
    def is_remote(self) -> bool:
        return True

    def uri(self, key: str) -> str | None:
        return f"s3://{self._bucket}/{key}"


class LocalOnlyStore(ObjectStore):
    """Used when no bucket exists: images stay in the local cache."""

    @override
    def upload_file(self, local: Path, key: str) -> None:
        return None

    @property
    def is_remote(self) -> bool:
        return False

    @override
    def uri(self, key: str) -> str | None:
        return None


class StackBucketLocator:
    """Reads the private bucket name from the stage stack's outputs."""

    OUTPUT_KEY = "OriginalsBucketName"

    def __init__(self, client: CloudFormationClient, stack: str) -> None:
        self._client = client
        self._stack = stack

    def bucket(self) -> str | None:
        try:
            stacks = self._client.describe_stacks(StackName=self._stack)["Stacks"]
        except (BotoCoreError, ClientError):
            return None
        outputs = stacks[0].get("Outputs", []) if stacks else []
        names = [o.get("OutputValue") for o in outputs if o.get("OutputKey") == self.OUTPUT_KEY]
        return names[0] if names else None
