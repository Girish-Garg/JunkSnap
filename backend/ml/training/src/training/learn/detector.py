"""Detector runs and their per-class test numbers, independent of the training library."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class DetectorRun:
    base: str  # pretrained checkpoint name, e.g. yolo26s.pt
    data: Path  # data.yaml written by `training yolo-export`
    epochs: int
    imgsz: int
    out: Path
    name: str
    batch: int = 32
    cache_images: bool = False


@dataclass(frozen=True)
class ClassScores:
    name: str
    instances: int
    precision: float
    recall: float
    map50: float
    map50_95: float

    def row(self) -> str:
        return (
            f"| {self.name} | {self.instances} | {self.precision:.3f} | {self.recall:.3f} "
            f"| {self.map50:.3f} | {self.map50_95:.3f} |"
        )


@dataclass(frozen=True)
class DetectorReport:
    weights: str
    split: str
    images: int
    classes: tuple[ClassScores, ...]
    overall: ClassScores

    def table(self) -> str:
        head = "| class | boxes | precision | recall | mAP50 | mAP50-95 |\n|---|---|---|---|---|---|"
        rows = [c.row() for c in (*self.classes, self.overall)]
        return "\n".join([head, *rows])

    def to_json(self) -> dict[str, Any]:
        return {"weights": self.weights, "split": self.split, "images": self.images,
                "classes": [c.__dict__ for c in self.classes], "overall": self.overall.__dict__}


@dataclass(frozen=True)
class ExportSpec:
    """One ONNX build: the server's full-precision model or the phone's small one."""

    imgsz: int
    half: bool = False
    int8: bool = False

    @property
    def suffix(self) -> str:
        precision = "int8" if self.int8 else "fp16" if self.half else "fp32"
        return f"{self.imgsz}-{precision}"

