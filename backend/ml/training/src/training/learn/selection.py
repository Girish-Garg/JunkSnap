"""Picks the regularisation of the embedding heads on val, then scores them once on test."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from statistics import mean
from typing import Any

import numpy as np

from training.domain import ManifestRow
from training.learn.domain import BinaryScores
from training.learn.heads import HeadSet, HeadSpec, HeadTrainer
from training.learn.ports import LinearFitter

STRENGTHS = (1.0, 10.0, 100.0)


@dataclass(frozen=True)
class HeadResult:
    heads: HeadSet
    strength: float
    val: tuple[BinaryScores, ...]
    test: tuple[BinaryScores, ...]

    def to_json(self, embedder: str, version: str) -> dict[str, Any]:
        """The shape ml.domain.linear.EmbeddingHeads reads, plus how it was chosen."""
        first = next(iter(self.heads.groups.values()))
        return {
            "version": version,
            "embedder": embedder,
            "dim": len(first.weights[0]),
            "strength": self.strength,
            "groups": self.heads.to_json(),
            "val": [s.__dict__ for s in self.val],
            "test": [s.__dict__ for s in self.test],
        }

    def table(self) -> str:
        lines = ["| head | split | positives | precision | recall | F1 |", "|---" * 6 + "|"]
        for split, scores in (("val", self.val), ("test", self.test)):
            lines += [
                f"| {s.name} | {split} | {s.support} | {s.precision:.3f} | {s.recall:.3f} "
                f"| {s.f1:.3f} |"
                for s in scores
            ]
        return "\n".join(lines)


class HeadSelector:
    def __init__(
        self, specs: tuple[HeadSpec, ...], fitter: Callable[[float], LinearFitter]
    ) -> None:
        self._specs = specs
        self._fitter = fitter

    def select(self, rows: list[ManifestRow], vectors: dict[str, np.ndarray]) -> HeadResult:
        best: tuple[float, HeadResult] | None = None
        for strength in STRENGTHS:
            trainer = HeadTrainer(self._fitter(strength), self._specs)
            heads = trainer.train(rows, vectors)
            val = tuple(trainer.scores(heads, rows, vectors, "val"))
            score = mean(s.f1 for s in val)
            if best is None or score > best[0]:
                test = tuple(trainer.scores(heads, rows, vectors, "test"))
                best = (score, HeadResult(heads, strength, val, test))
        assert best is not None
        return best[1]
