"""Bedrock vision judge benchmark: accuracy, latency and cost per model on one fixed sample."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from statistics import median
from typing import Any

PER_THOUSAND = 1000


@dataclass(frozen=True)
class BenchRow:
    model: str
    photos: int
    answered: int
    type_accuracy: float
    type_photos: int
    burning_accuracy: float
    burning_photos: int
    median_ms: float
    p90_ms: float
    usd_per_thousand: float

    @staticmethod
    def header() -> str:
        return (
            "| model | photos | answered | waste or not (accuracy) | burning (accuracy) "
            "| median latency | p90 latency | USD per 1,000 photos |\n" + "|---" * 8 + "|"
        )

    def row(self) -> str:
        return (
            f"| {self.model} | {self.photos} | {self.answered} "
            f"| {self.type_accuracy:.3f} (n={self.type_photos}) "
            f"| {self.burning_accuracy:.3f} (n={self.burning_photos}) "
            f"| {self.median_ms / 1000:.1f} s | {self.p90_ms / 1000:.1f} s "
            f"| {self.usd_per_thousand:.2f} |"
        )


class JudgeBench:
    """Unanswered photos count as wrong, so a model that often fails cannot look accurate."""

    def summarise(self, model: str, rows: Sequence[Mapping[str, Any]]) -> BenchRow:
        answered = [r for r in rows if r.get("judge")]
        typed = [r for r in rows if r["truth"].get("waste") is not None]
        fire = [r for r in rows if r["truth"]["source"] == "dfire"]
        latencies = sorted(float(r["judge"]["latency_ms"]) for r in answered) or [0.0]
        usd = sum(float(r["judge_cost"]["usd"]) for r in answered)
        return BenchRow(
            model=model,
            photos=len(rows),
            answered=len(answered),
            type_accuracy=self._share(typed, self._type_right),
            type_photos=len(typed),
            burning_accuracy=self._share(fire, self._burning_right),
            burning_photos=len(fire),
            median_ms=median(latencies),
            p90_ms=latencies[int(0.9 * (len(latencies) - 1))],
            usd_per_thousand=usd / max(len(answered), 1) * PER_THOUSAND,
        )

    @staticmethod
    def _share(rows: list[Mapping[str, Any]], right: Any) -> float:
        return sum(bool(right(r)) for r in rows) / max(len(rows), 1)

    @staticmethod
    def _type_right(row: Mapping[str, Any]) -> bool:
        judge: Any = row.get("judge")
        return bool(judge) and (judge["report_type"] != "not_waste") == row["truth"]["waste"]

    @staticmethod
    def _burning_right(row: Mapping[str, Any]) -> bool:
        judge: Any = row.get("judge")
        return bool(judge) and bool(judge["burning"]) == bool(row["truth"]["burning"])
