"""Tables for docs/ml/eval.md: each signal alone, and the combiners replayed end to end."""

from __future__ import annotations

from training.learn.cascade import Calibration, Cascade, CascadeReport
from training.learn.domain import BinaryScores
from training.learn.heads import DECIDE_AT
from training.learn.stacker import (
    FIXED_WEIGHTS,
    JUDGE,
    SIGNALS,
    MetaLearner,
    ScoredPhoto,
    WeightedMean,
)


class StackReport:
    def __init__(self, meta: MetaLearner) -> None:
        self._meta = meta

    def signals_alone(self, photos: list[ScoredPhoto]) -> str:
        lines = ["| signal | photos | precision | recall | F1 | ECE |", "|---" * 6 + "|"]
        for name in (*SIGNALS, JUDGE):
            scored = [p for p in photos if name in p.scores]
            if not scored:
                continue
            truth = [p.waste for p in scored]
            probs = [p.scores[name] for p in scored]
            s = BinaryScores.of(name, truth, [x >= DECIDE_AT for x in probs])
            lines.append(
                f"| {name} | {len(scored)} | {s.precision:.3f} | {s.recall:.3f} | {s.f1:.3f} "
                f"| {Calibration.ece(probs, truth):.3f} |"
            )
        return "\n".join(lines)

    def cascades(self, photos: list[ScoredPhoto]) -> list[CascadeReport]:
        fixed = WeightedMean(FIXED_WEIGHTS)
        return [
            Cascade(fixed, fixed).evaluate("fixed weights (fw-v0)", photos),
            Cascade(self._meta.base, self._meta.judged).evaluate(
                f"meta-learner ({self._meta.version})", photos
            ),
        ]

    def table(self, photos: list[ScoredPhoto]) -> str:
        rows = [report.row() for report in self.cascades(photos)]
        return "\n".join([CascadeReport.header(), *rows])
