"""Sources shipped as one zip with one folder per image class."""

from __future__ import annotations

import posixpath
import zipfile
from collections.abc import Iterator
from pathlib import Path
from typing import override

from training.ports import Downloader
from training.sources.base import DatasetSource, RawItem, SourceInfo
from training.sources.coco import Archive
from training.utils import evenly_spaced, safe_stem, short_hash, zip_reader

IMAGE_SUFFIXES = (".jpg", ".jpeg", ".png", ".webp")


class FolderZipSource(DatasetSource):
    """`folders` maps the end of a folder path inside the zip to a source class name."""

    def __init__(
        self, info: SourceInfo, downloader: Downloader, archive: Archive, folders: dict[str, str]
    ) -> None:
        super().__init__(info, downloader)
        self._archive = archive
        self._folders = folders

    @override
    def download(self, cache: Path, limit: int | None) -> None:
        self.ensure_file(self._archive.url, self.raw_dir(cache) / self._archive.filename)

    def items(self, cache: Path, limit: int | None = None) -> Iterator[RawItem]:
        with zipfile.ZipFile(self.raw_dir(cache) / self._archive.filename) as zf:
            members = sorted(n for n in zf.namelist() if n.lower().endswith(IMAGE_SUFFIXES))
            labelled = [(n, label) for n in members if (label := self._label(n))]
            for member, label in evenly_spaced(labelled, limit):
                yield RawItem(
                    stem=f"{label}_{safe_stem(posixpath.basename(member))}_{short_hash(member)}",
                    read=zip_reader(zf, member),
                    labels=(label,),
                )

    def _label(self, member: str) -> str | None:
        folder = posixpath.dirname(member).lower()
        matches = [label for end, label in self._folders.items() if folder.endswith(end)]
        return matches[0] if matches else None
