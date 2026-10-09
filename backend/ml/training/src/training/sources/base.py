"""The interface every public dataset source implements."""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from pathlib import Path

from training.domain import Box
from training.ports import Downloader


@dataclass(frozen=True)
class SourceInfo:
    name: str
    licence: str
    url: str


@dataclass(frozen=True)
class RawItem:
    """One image as found in the download; `read` returns the original bytes."""

    stem: str
    read: Callable[[], bytes]
    labels: tuple[str, ...] = ()
    boxes: tuple[Box, ...] = ()


class DatasetSource(ABC):
    def __init__(self, info: SourceInfo, downloader: Downloader) -> None:
        self.info = info
        self._downloader = downloader

    def raw_dir(self, cache: Path) -> Path:
        return cache / self.info.name / "raw"

    def ensure_file(self, url: str, dest: Path) -> Path:
        """Downloads once; an existing non-empty file is reused."""
        if not dest.exists() or dest.stat().st_size == 0:
            self._downloader.download(url, dest)
        return dest

    @abstractmethod
    def download(self, cache: Path, limit: int | None) -> None: ...

    @abstractmethod
    def items(self, cache: Path, limit: int | None = None) -> Iterator[RawItem]: ...

