"""Logistic heads on image embeddings: report type, materials and the burning hazard."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import numpy as np

from training.domain import ManifestRow
from training.learn.domain import BinaryScores, LinearModel
from training.learn.ports import LinearFitter

# Fewer training positives than this and a head would be guesswork, so it is not trained.
MIN_POSITIVES = 40
LABELLED_TYPES = ("waste_dump", "not_waste")
MATERIAL_SOURCES = ("garbage_od", "taco")
DECIDE_AT = 0.5


@dataclass(frozen=True)
class HeadSpec:
    group: str  # report_type, materials or hazards: the insight field the head feeds
    name: str
    eligible: Callable[[ManifestRow], bool]
    positive: Callable[[ManifestRow], bool]


class HeadCatalogue:
    """Which rows teach which head: only rows whose labels cover that question."""

    @staticmethod
    def defaults(materials: tuple[str, ...]) -> tuple[HeadSpec, ...]:
        report = HeadSpec(
            "report_type", "waste_dump",
            lambda r: r.report_type in LABELLED_TYPES, lambda r: r.report_type == "waste_dump",
        )
        material_specs = tuple(HeadCatalogue._material(m) for m in materials)
        burning = HeadSpec("hazards", "burning", lambda _: True, lambda r: "burning" in r.hazards)
        return (report, *material_specs, burning)

    @staticmethod
    def _material(material: str) -> HeadSpec:
        return HeadSpec(
            "materials", material,
            lambda r: r.source in MATERIAL_SOURCES, lambda r: material in r.materials,
        )


@dataclass(frozen=True)
class HeadSet:
    groups: dict[str, LinearModel]

    def probabilities(self, group: str, matrix: np.ndarray) -> np.ndarray:
        model = self.groups[group]
        logits = matrix @ np.asarray(model.weights).T + np.asarray(model.biases)
        return np.asarray(0.5 * (1.0 + np.tanh(logits / 2.0)))  # sigmoid without overflow

    def to_json(self) -> dict[str, Any]:
        return {group: model.to_json() for group, model in self.groups.items()}


class HeadTrainer:
    def __init__(self, fitter: LinearFitter, specs: tuple[HeadSpec, ...]) -> None:
        self._fitter = fitter
        self._specs = specs

    def train(self, rows: list[ManifestRow], vectors: dict[str, np.ndarray]) -> HeadSet:
        """Fits on the train split only; heads with too few positives are skipped."""
        fitted: dict[str, list[LinearModel]] = {}
        for spec in self._specs:
            matrix, labels = self._data(spec, rows, vectors, "train")
            if labels.sum() < MIN_POSITIVES:
                continue
            fitted.setdefault(spec.group, []).append(self._fitter.fit(matrix, labels, spec.name))
        return HeadSet({group: LinearModel.stacked(models) for group, models in fitted.items()})

    def scores(
        self, heads: HeadSet, rows: list[ManifestRow], vectors: dict[str, np.ndarray], split: str
    ) -> list[BinaryScores]:
        """Precision, recall and F1 at p >= 0.5 for every trained head on one split."""
        results = []
        for spec in self._specs:
            model = heads.groups.get(spec.group)
            if model is None or spec.name not in model.classes:
                continue
            matrix, labels = self._data(spec, rows, vectors, split)
            column = model.classes.index(spec.name)
            predicted = heads.probabilities(spec.group, matrix)[:, column] >= DECIDE_AT
            name = f"{spec.group}:{spec.name}"
            results.append(BinaryScores.of(name, labels.tolist(), predicted.tolist()))
        return results

    @staticmethod
    def _data(
        spec: HeadSpec, rows: list[ManifestRow], vectors: dict[str, np.ndarray], split: str
    ) -> tuple[np.ndarray, np.ndarray]:
        chosen = [r for r in rows if r.split == split and spec.eligible(r) and r.id in vectors]
        matrix = np.stack([vectors[r.id] for r in chosen]) if chosen else np.zeros((0, 1))
        return matrix, np.array([spec.positive(r) for r in chosen], dtype=bool)

