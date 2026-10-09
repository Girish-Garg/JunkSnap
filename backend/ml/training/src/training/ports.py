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


class ObjectStore(ABC):
    """Where dataset images go; keys are relative to the bucket."""

    @abstractmethod
    def upload_file(self, local: Path, key: str) -> None: ...

    @property
    @abstractmethod
    def is_remote(self) -> bool: ...

    @abstractmethod
    def uri(self, key: str) -> str | None: ...
