"""The stacking meta-learner: logistic models over signal logits, fitted on the val split."""

from __future__ import annotations

import math
from abc import ABC, abstractmethod
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

import numpy as np

from training.domain import ConfigError
from training.learn.ports import LinearFitter

SIGNALS = ("rekognition_labels", "yolo", "embedding_classifier")
JUDGE = "vision_judge"
CLIP = 0.01  # same clip as ml.domain.linear before the logit
# The fixed weights the meta-learner replaces (ml.services.combiner, fw-v0).
FIXED_WEIGHTS = {"rekognition_labels": 0.4, "yolo": 0.3, "embedding_classifier": 0.3,
                 "vision_judge": 0.6}


@dataclass(frozen=True)
class ScoredPhoto:
    """One labelled photo with each signal's score and, when it ran, the judge's."""

    photo_id: str
    waste: bool
    scores: Mapping[str, float]
    judge_usd: float

    @property
    def judged(self) -> bool:
        return JUDGE in self.scores

    @staticmethod
    def from_json(raw: Mapping[str, Any]) -> ScoredPhoto | None:
        """None for photos without a waste label (the fire photos)."""
        waste = raw["truth"].get("waste")
        if waste is None:
            return None
        scores = dict(raw["signals"])
        if raw.get("judge"):
            scores[JUDGE] = float(raw["judge"]["score"])
        usd = float((raw.get("judge_cost") or {}).get("usd", 0.0))
        return ScoredPhoto(raw["id"], bool(waste), scores, usd)


class ScoreMerge:
    """Signals scored in separate runs over the same photos, joined by id."""

    def __init__(self) -> None:
        self._rows: dict[str, dict[str, Any]] = {}

    def add(self, rows: list[dict[str, Any]]) -> None:
        for raw in rows:
            row = self._rows.setdefault(raw["id"], {"id": raw["id"], "truth": raw["truth"],
                                                    "signals": {}})
            row["signals"].update(raw.get("signals", {}))
            if raw.get("judge"):
                row["judge"], row["judge_cost"] = raw["judge"], raw.get("judge_cost")

    def rows(self) -> list[dict[str, Any]]:
        return list(self._rows.values())


class Combination(ABC):
    """A way to turn signal scores into one probability, before or after the judge."""

    @abstractmethod
    def probability(self, scores: Mapping[str, float]) -> float: ...


@dataclass(frozen=True)
class LogitModel(Combination):
    signals: tuple[str, ...]
    weights: tuple[float, ...]
    bias: float

    def probability(self, scores: Mapping[str, float]) -> float:
        pairs = zip(self.signals, self.weights, strict=True)
        z = self.bias + math.fsum(w * self.logit(scores[s]) for s, w in pairs if s in scores)
        return 1.0 / (1.0 + math.exp(-z)) if z >= 0 else math.exp(z) / (1.0 + math.exp(z))

    @staticmethod
    def logit(score: float) -> float:
        p = min(max(score, CLIP), 1.0 - CLIP)
        return math.log(p / (1.0 - p))

    def to_json(self) -> dict[str, Any]:
        return {"signals": list(self.signals), "weights": list(self.weights), "bias": self.bias}


@dataclass(frozen=True)
class WeightedMean(Combination):
    weights: Mapping[str, float]

    def probability(self, scores: Mapping[str, float]) -> float:
        total = sum(self.weights[s] for s in scores)
        return sum(self.weights[s] * v for s, v in scores.items()) / total


@dataclass(frozen=True)
class MetaLearner:
    version: str
    base: LogitModel
    judged: LogitModel

    def to_json(self, fitted_on: dict[str, int]) -> dict[str, Any]:
        return {"version": self.version, "base": self.base.to_json(),
                "judged": self.judged.to_json(), "fitted_on": fitted_on}


class StackerTrainer:
    def __init__(self, fitter: LinearFitter) -> None:
        self._fitter = fitter

    def fit(self, val: list[ScoredPhoto], version: str) -> MetaLearner:
        judged = [p for p in val if p.judged]
        if len(judged) < len(SIGNALS) * 10:
            raise ConfigError("too few judged val photos to fit the judged model")
        return MetaLearner(
            version,
            self._fit(val, SIGNALS, "base"),
            self._fit(judged, (*SIGNALS, JUDGE), "judged"),
        )

    def _fit(self, photos: list[ScoredPhoto], signals: tuple[str, ...], name: str) -> LogitModel:
        rows = [[LogitModel.logit(p.scores.get(s, 0.5)) for s in signals] for p in photos]
        matrix = np.array(rows)
        labels = np.array([p.waste for p in photos], dtype=bool)
        model = self._fitter.fit(matrix, labels, name)
        return LogitModel(signals, model.weights[0], model.biases[0])
