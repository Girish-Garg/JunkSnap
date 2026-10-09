"""Replays the verifier on scored test photos: signals, the judge only when unsure, a decision."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass

from training.learn.stacker import JUDGE, SIGNALS, Combination, ScoredPhoto

AUTO_VERIFY_MIN = 0.85
COMMUNITY_MIN = 0.5
DISAGREEMENT_GAP = 0.5
BINS = 10


@dataclass(frozen=True)
class CascadeReport:
    name: str
    photos: int
    accuracy: float
    brier: float
    ece: float
    judge_rate: float
    auto_verified: tuple[int, int]  # decided, of which right
    rejected: tuple[int, int]
    community: int
    judge_usd: float

    @staticmethod
    def header() -> str:
        return (
            "| combiner | photos | accuracy | Brier | ECE | judge called | auto-verified (right) "
            "| rejected (right) | community check | judge cost |\n"
            "|---|---|---|---|---|---|---|---|---|---|"
        )

    def row(self) -> str:
        return (
            f"| {self.name} | {self.photos} | {self.accuracy:.3f} | {self.brier:.3f} "
            f"| {self.ece:.3f} | {self.judge_rate:.0%} | {self.auto_verified[0]} "
            f"({self.auto_verified[1]}) | {self.rejected[0]} ({self.rejected[1]}) "
            f"| {self.community} | ${self.judge_usd:.3f} |"
        )


@dataclass(frozen=True)
class Step:
    probability: float
    split: bool
    judged: bool


class Cascade:
    def __init__(self, base: Combination, judged: Combination) -> None:
        self._base = base
        self._judged = judged

    def step(self, photo: ScoredPhoto) -> Step:
        first = {s: photo.scores[s] for s in SIGNALS if s in photo.scores}
        probability, split = self._base.probability(first), self.disagree(first)
        unsure = COMMUNITY_MIN <= probability < AUTO_VERIFY_MIN
        if (split or unsure) and photo.judged:
            scores = {**first, JUDGE: photo.scores[JUDGE]}
            return Step(self._judged.probability(scores), self.disagree(scores), True)
        return Step(probability, split, False)

    def evaluate(self, name: str, photos: list[ScoredPhoto]) -> CascadeReport:
        steps = [self.step(p) for p in photos]
        truth = [p.waste for p in photos]
        probs = [s.probability for s in steps]
        decisions = [self.decision(s) for s in steps]
        return CascadeReport(
            name=name,
            photos=len(photos),
            accuracy=sum((p >= COMMUNITY_MIN) == t for p, t in zip(probs, truth, strict=True))
            / len(photos),
            brier=sum((p - t) ** 2 for p, t in zip(probs, truth, strict=True)) / len(photos),
            ece=Calibration.ece(probs, truth),
            judge_rate=sum(s.judged for s in steps) / len(photos),
            auto_verified=self._count(decisions, truth, "auto_verified", True),
            rejected=self._count(decisions, truth, "rejected", False),
            community=decisions.count("community_check"),
            judge_usd=sum(p.judge_usd for p, s in zip(photos, steps, strict=True) if s.judged),
        )

    @staticmethod
    def disagree(scores: Mapping[str, float]) -> bool:
        values = list(scores.values())
        return len(values) > 1 and max(values) - min(values) >= DISAGREEMENT_GAP

    @staticmethod
    def decision(step: Step) -> str:
        if step.split or COMMUNITY_MIN <= step.probability < AUTO_VERIFY_MIN:
            return "community_check"
        return "auto_verified" if step.probability >= AUTO_VERIFY_MIN else "rejected"

    @staticmethod
    def _count(decisions: list[str], truth: list[bool], kind: str, right: bool) -> tuple[int, int]:
        picked = [t for d, t in zip(decisions, truth, strict=True) if d == kind]
        return len(picked), sum(t == right for t in picked)


class Calibration:
    @staticmethod
    def ece(probs: list[float], truth: list[bool]) -> float:
        """Expected calibration error over ten equal-width bins."""
        total = 0.0
        for b in range(BINS):
            members = [(p, t) for p, t in zip(probs, truth, strict=True)
                       if b / BINS <= p < (b + 1) / BINS or (b == BINS - 1 and p == 1.0)]
            if members:
                confidence = sum(p for p, _ in members) / len(members)
                hit_rate = sum(t for _, t in members) / len(members)
                total += len(members) / len(probs) * abs(confidence - hit_rate)
        return total
