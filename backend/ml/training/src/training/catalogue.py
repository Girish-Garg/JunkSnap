"""Every dataset JunkSnap uses, with its licence. Details and reasons: data/datasets/SOURCES.md."""

from __future__ import annotations

from training.ports import Downloader
from training.sources.base import DatasetSource, SourceInfo
from training.sources.coco import Archive, CocoZipSource
from training.sources.dfire import DFireSource
from training.sources.folders import FolderZipSource
from training.sources.taco import TacoSource

HF = "https://huggingface.co/datasets/keremberke/garbage-object-detection/resolve/main/data"

QR4CHANGE = SourceInfo("qr4change", "CC-BY-4.0", "https://doi.org/10.17632/zndzygc3p3.2")
TACO = SourceInfo("taco", "CC-BY-4.0", "https://zenodo.org/records/3587843")
GARBAGE_OD = SourceInfo(
    "garbage_od", "CC-BY-4.0",
    "https://universe.roboflow.com/material-identification/garbage-classification-3/dataset/2",
)
DFIRE = SourceInfo("dfire", "CC0-1.0", "https://github.com/gaiasd/DFireDataset")


class SourceCatalogue:
    def __init__(self, downloader: Downloader) -> None:
        self._sources: dict[str, DatasetSource] = {
            s.info.name: s for s in self._build(downloader)
        }

    @staticmethod
    def _build(downloader: Downloader) -> list[DatasetSource]:
        return [
            FolderZipSource(
                QR4CHANGE, downloader,
                Archive("https://data.mendeley.com/public-api/zip/zndzygc3p3/download/2",
                        "qr4change.zip"),
                {"garbage/yes": "garbage", "garbage/no": "non_garbage"},
            ),
            TacoSource(TACO, downloader),
            CocoZipSource(
                GARBAGE_OD, downloader,
                tuple(Archive(f"{HF}/{s}.zip", f"{s}.zip") for s in ("train", "valid", "test")),
            ),
            DFireSource(DFIRE, downloader),
        ]

    def names(self) -> list[str]:
        return list(self._sources)

    def get(self, name: str) -> DatasetSource:
        return self._sources[name]

    def licences(self) -> dict[str, str]:
        return {name: s.info.licence for name, s in self._sources.items()}
