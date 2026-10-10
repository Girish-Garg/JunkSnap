"""Trained logistic models in plain Python: embedding heads and the stacking meta-learner."""

import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from types import MappingProxyType
from typing import Any

from ml.domain.errors import ConfigError

# Scores are clipped before the logit so a 0 or 1 never becomes infinite.
SCORE_CLIP = 0.01
# Report types a meta.json without "report_types" was fitted on (before contracts v1.7).
TRAINED_REPORT_TYPES = frozenset(
    {"waste_dump", "no_bin", "contaminated_water", "open_construction"}
)


class Logistic:
    @staticmethod
    def sigmoid(z: float) -> float:
        if z >= 0:
            return 1.0 / (1.0 + math.exp(-z))
        return math.exp(z) / (1.0 + math.exp(z))

    @staticmethod
    def logit(score: float, clip: float = SCORE_CLIP) -> float:
        p = min(max(score, clip), 1.0 - clip)
        return math.log(p / (1.0 - p))


@dataclass(frozen=True)
class LogisticHead:
    """One sigmoid output per class over the same input vector."""

    classes: tuple[str, ...]
    weights: tuple[tuple[float, ...], ...]
    biases: tuple[float, ...]

    def probabilities(self, x: Sequence[float]) -> dict[str, float]:
        return {
            name: Logistic.sigmoid(math.fsum(w * v for w, v in zip(row, x, strict=True)) + bias)
            for name, row, bias in zip(self.classes, self.weights, self.biases, strict=True)
        }

    @staticmethod
    def from_json(raw: Mapping[str, Any], dim: int) -> "LogisticHead":
        head = LogisticHead(
            tuple(raw["classes"]),
            tuple(tuple(float(w) for w in row) for row in raw["weights"]),
            tuple(float(b) for b in raw["biases"]),
        )
        if any(len(row) != dim for row in head.weights) or len(head.biases) != len(head.classes):
            raise ConfigError(f"head {head.classes} does not match a {dim}-dim embedding")
        return head


@dataclass(frozen=True)
class EmbeddingHeads:
    """The embedding classifier: report type, materials and hazards heads of one embedder."""

    version: str
    embedder: str
    dim: int
    groups: Mapping[str, LogisticHead]

    def probabilities(self, group: str, vector: Sequence[float]) -> dict[str, float]:
        head = self.groups.get(group)
        return {} if head is None else head.probabilities(vector)

    @staticmethod
    def from_json(raw: Mapping[str, Any]) -> "EmbeddingHeads":
        dim = int(raw["dim"])
        groups = {name: LogisticHead.from_json(h, dim) for name, h in raw["groups"].items()}
        return EmbeddingHeads(raw["version"], raw["embedder"], dim, MappingProxyType(groups))


@dataclass(frozen=True)
class SignalLogistic:
    """p = sigmoid(sum of w * logit(score) + b); a missing signal adds nothing."""

    signals: tuple[str, ...]
    weights: tuple[float, ...]
    bias: float

    def probability(self, scores: Mapping[str, float]) -> float:
        pairs = zip(self.signals, self.weights, strict=True)
        total = self.bias + math.fsum(
            w * Logistic.logit(scores[name]) for name, w in pairs if name in scores
        )
        return Logistic.sigmoid(total)

    @staticmethod
    def from_json(raw: Mapping[str, Any]) -> "SignalLogistic":
        model = SignalLogistic(
            tuple(raw["signals"]), tuple(float(w) for w in raw["weights"]), float(raw["bias"])
        )
        if len(model.signals) != len(model.weights):
            raise ConfigError("meta-learner needs one weight per signal")
        return model


@dataclass(frozen=True)
class MetaModel:
    """Fitted on val: `base` before the judge, `judged` after it, each with a fallback."""

    version: str
    base: SignalLogistic
    judged: SignalLogistic
    fallback: SignalLogistic | None = None  # Rekognition only, for claims our models cannot see
    fallback_judged: SignalLogistic | None = None
    report_types: frozenset[str] = TRAINED_REPORT_TYPES  # claims with training rows

    def covers(self, report_type: str) -> bool:
        return report_type in self.report_types

    def pick(self, present: frozenset[str], judged: bool) -> SignalLogistic:
        """The full model needs every one of its signals; its bias assumes they all spoke."""
        full = self.judged if judged else self.base
        spare = self.fallback_judged if judged else self.fallback
        if spare is None or set(full.signals) <= present:
            return full
        return spare

    @staticmethod
    def from_json(raw: Mapping[str, Any]) -> "MetaModel":
        spare = {k: SignalLogistic.from_json(raw[k]) for k in ("fallback", "fallback_judged")
                 if k in raw}
        return MetaModel(
            raw["version"],
            SignalLogistic.from_json(raw["base"]),
            SignalLogistic.from_json(raw["judged"]),
            spare.get("fallback"),
            spare.get("fallback_judged"),
            frozenset(raw.get("report_types", TRAINED_REPORT_TYPES)),
        )
