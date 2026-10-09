"""Value objects of model training: teacher boxes, linear models, metrics and model files."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

from training.domain import Box, ConfigError


@dataclass(frozen=True)
class QueryHit:
    """One box an open-vocabulary teacher found for one of its text queries."""

    query: int
    box: Box
    score: float


@dataclass(frozen=True)
class TeacherPrompt:
    """Text queries whose boxes become one detector class, only on rows of some report types."""

    label: str
    queries: tuple[str, ...]
    min_score: float
    report_types: tuple[str, ...] = ()
    min_best: float | None = None  # a lower bar for the best box where people saw the class

    def wanted_for(self, report_type: str | None) -> bool:
        return not self.report_types or report_type in self.report_types


@dataclass(frozen=True)
class TeacherRecord:
    image_id: str
    model: str
    boxes: tuple[Box, ...]
    scores: tuple[float, ...]

    def to_json(self) -> dict[str, Any]:
        boxes = [{"label": b.label, "x": b.x, "y": b.y, "w": b.w, "h": b.h} for b in self.boxes]
        return {"image_id": self.image_id, "model": self.model, "boxes": boxes,
                "scores": [round(s, 4) for s in self.scores]}

    @staticmethod
    def from_json(raw: dict[str, Any]) -> TeacherRecord:
        boxes = tuple(Box(**box) for box in raw["boxes"])
        return TeacherRecord(raw["image_id"], raw["model"], boxes, tuple(raw["scores"]))


@dataclass(frozen=True)
class LinearModel:
    """Logistic model: p = sigmoid(w . x + b); `classes` name each output column."""

    classes: tuple[str, ...]
    weights: tuple[tuple[float, ...], ...]
    biases: tuple[float, ...]

    def __post_init__(self) -> None:
        if not (len(self.classes) == len(self.weights) == len(self.biases)):
            raise ConfigError("a linear model needs one weight row and bias per class")

    def probabilities(self, features: tuple[float, ...]) -> dict[str, float]:
        return {
            name: _sigmoid(sum(w * x for w, x in zip(row, features, strict=True)) + bias)
            for name, row, bias in zip(self.classes, self.weights, self.biases, strict=True)
        }

    def to_json(self) -> dict[str, Any]:
        return {"classes": list(self.classes), "weights": [list(r) for r in self.weights],
                "biases": list(self.biases)}

    @staticmethod
    def stacked(models: list[LinearModel]) -> LinearModel:
        """One model with every output of several models, in order."""
        return LinearModel(
            classes=tuple(c for m in models for c in m.classes),
            weights=tuple(w for m in models for w in m.weights),
            biases=tuple(b for m in models for b in m.biases),
        )


def _sigmoid(z: float) -> float:
    return 1.0 / (1.0 + math.exp(-z)) if z >= 0 else math.exp(z) / (1.0 + math.exp(z))


@dataclass(frozen=True)
class BinaryScores:
    """Precision, recall and F1 of one yes/no output on one split."""

    name: str
    support: int
    precision: float
    recall: float
    f1: float

    @staticmethod
    def of(name: str, truth: list[bool], predicted: list[bool]) -> BinaryScores:
        hits = sum(t and p for t, p in zip(truth, predicted, strict=True))
        precision = hits / max(sum(predicted), 1)
        recall = hits / max(sum(truth), 1)
        f1 = 2 * precision * recall / (precision + recall) if hits else 0.0
        return BinaryScores(name, sum(truth), precision, recall, f1)


@dataclass(frozen=True)
class ModelFile:
    """One trained model file as the ml service pins it: S3 key, SHA-256 and size."""

    name: str
    key: str
    sha256: str
    size_bytes: int

    def to_json(self) -> dict[str, Any]:
        return {"key": self.key, "sha256": self.sha256, "size_bytes": self.size_bytes}
