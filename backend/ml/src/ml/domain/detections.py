"""Boxes from our own detector, as fractions of the image, and what they add up to."""

from collections.abc import Iterable
from dataclasses import dataclass


@dataclass(frozen=True)
class Detection:
    label: str
    confidence: float  # 0..1
    x0: float
    y0: float
    x1: float
    y1: float

    @property
    def area(self) -> float:
        return max(self.x1 - self.x0, 0.0) * max(self.y1 - self.y0, 0.0)

    def near(self, other: "Detection", reach: float) -> bool:
        """True when `other` touches this box grown by `reach` times its longer side."""
        margin = reach * max(self.x1 - self.x0, self.y1 - self.y0)
        return (
            other.x0 <= self.x1 + margin
            and other.x1 >= self.x0 - margin
            and other.y0 <= self.y1 + margin
            and other.y1 >= self.y0 - margin
        )


@dataclass(frozen=True)
class DetectionSet:
    detections: tuple[Detection, ...]
    model: str
    version: str
    latency_ms: int

    def of(self, labels: Iterable[str]) -> tuple[Detection, ...]:
        wanted = set(labels)
        return tuple(d for d in self.detections if d.label in wanted)

    def best(self, labels: Iterable[str]) -> float:
        """Highest confidence among the given classes, 0 when none was found."""
        wanted = set(labels)
        return max((d.confidence for d in self.detections if d.label in wanted), default=0.0)

    def coverage(self, labels: Iterable[str], min_confidence: float) -> float:
        """Share of the image under confident boxes of the given classes (overlaps capped at 1)."""
        wanted = set(labels)
        area = sum(
            d.area for d in self.detections if d.label in wanted and d.confidence >= min_confidence
        )
        return min(area, 1.0)

    def notes(self, limit: int = 4) -> tuple[str, ...]:
        ranked = sorted(self.detections, key=lambda d: -d.confidence)[:limit]
        return tuple(f"{d.label} {d.confidence:.2f}" for d in ranked)
