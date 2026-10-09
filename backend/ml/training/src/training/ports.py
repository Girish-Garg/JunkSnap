"""Outside capabilities the dataset steps depend on."""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any


class Downloader(ABC):
    @abstractmethod
    def download(self, url: str, dest: Path) -> None: ...

    @abstractmethod
    def get_json(self, url: str) -> Any: ...

    @abstractmethod
    def fetch(self, url: str) -> bytes: ...


class ObjectStore(ABC):
    """Where dataset files go; keys are relative to the private bucket."""

    @abstractmethod
    def upload_file(self, local: Path, key: str) -> None: ...

    @abstractmethod
    def read(self, key_or_uri: str) -> bytes | None:
        """Returns None when the object does not exist; an `s3://` URI may name another bucket."""

    @property
    @abstractmethod
    def is_remote(self) -> bool: ...

    @abstractmethod
    def uri(self, key: str) -> str | None: ...


class ImageWriter(ABC):
    @abstractmethod
    def write(self, data: bytes, dest: Path) -> None: ...
