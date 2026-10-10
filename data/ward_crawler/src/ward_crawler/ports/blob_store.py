from abc import ABC, abstractmethod


class BlobStore(ABC):
    """Keyed bytes under one prefix: S3 crawl/ in the cluster, a local folder in dev."""

    @abstractmethod
    def get(self, key: str) -> bytes | None:
        """None when the key does not exist; raise StoreError for any other failure."""

    @abstractmethod
    def put(self, key: str, data: bytes, content_type: str) -> None:
        """Raise StoreError when the write fails."""

    @abstractmethod
    def where(self, key: str) -> str:
        """A readable location for logs, such as s3://bucket/crawl/key."""
