"""Outside capabilities model training depends on: teachers, embedders and model fitting."""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path

import numpy as np

from training.learn.detector import DetectorReport, DetectorRun, ExportSpec
from training.learn.domain import LinearModel, QueryHit


class BoxTeacher(ABC):
    """An open-vocabulary detector that boxes what text queries describe."""

    @property
    @abstractmethod
    def model(self) -> str: ...

    @abstractmethod
    def hits(self, image: Path, queries: tuple[str, ...]) -> list[QueryHit]:
        """Boxes above the teacher's own floor, overlaps already merged per query."""


class ImageEmbedder(ABC):
    @property
    @abstractmethod
    def model(self) -> str: ...

    @abstractmethod
    def embed(self, images: list[Path]) -> list[tuple[float, ...]]:
        """One L2-normalised vector per image, in order."""


class LinearFitter(ABC):
    """Fits a logistic model; the trainer decides what the columns mean."""

    @abstractmethod
    def fit(self, features: np.ndarray, labels: np.ndarray, name: str) -> LinearModel:
        """One logistic output named `name`; features are rows, labels booleans."""


class DetectorTrainer(ABC):
    @abstractmethod
    def train(self, run: DetectorRun) -> Path:
        """Returns the best checkpoint."""

    @abstractmethod
    def evaluate(self, weights: Path, data: Path, split: str) -> DetectorReport: ...

    @abstractmethod
    def export(self, weights: Path, spec: ExportSpec, data: Path) -> Path:
        """Returns the ONNX file; `data` feeds int8 calibration."""
