"""LinearFitter over scikit-learn's LogisticRegression (BSD-3-Clause)."""

from __future__ import annotations

import numpy as np
from sklearn.linear_model import LogisticRegression

from training.domain import ConfigError
from training.learn.domain import LinearModel
from training.learn.ports import LinearFitter

MAX_ITER = 5000


class SklearnLogisticFitter(LinearFitter):
    """Unweighted classes, so the probabilities stay calibrated for shares and the stacker."""

    def __init__(self, strength: float = 1.0) -> None:
        self._c = strength

    def fit(self, features: np.ndarray, labels: np.ndarray, name: str) -> LinearModel:
        if labels.all() or not labels.any():
            raise ConfigError(f"{name}: needs both positive and negative examples")
        model = LogisticRegression(C=self._c, max_iter=MAX_ITER)
        model.fit(features, labels)
        weights = tuple(float(w) for w in model.coef_[0])
        return LinearModel((name,), (weights,), (float(model.intercept_[0]),))
