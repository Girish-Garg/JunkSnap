"""Value objects shared by every dataset step."""

from __future__ import annotations

from dataclasses import asdict, dataclass, replace
from typing import Any

SPLITS = ("train", "val", "test", "holdout")
TRAINABLE_SPLITS = ("train", "val")


class JunkSnapError(Exception):
    """Root of every error the training package raises on purpose."""


class ConfigError(JunkSnapError):
    """Settings or input files are missing or invalid."""


class ExternalServiceError(JunkSnapError):
    """A download or AWS call failed."""


@dataclass(frozen=True)
class Box:
    """One labelled box; x, y (top-left), w and h are fractions of the image size."""

    label: str
    x: float
    y: float
    w: float
    h: float

    def clipped(self) -> Box | None:
        x0, y0 = max(self.x, 0.0), max(self.y, 0.0)
        x1, y1 = min(self.x + self.w, 1.0), min(self.y + self.h, 1.0)
        if x1 <= x0 or y1 <= y0:
            return None
        return Box(self.label, x0, y0, x1 - x0, y1 - y0)

    def yolo_line(self, class_index: int) -> str:
        cx, cy = self.x + self.w / 2, self.y + self.h / 2
        return f"{class_index} {cx:.6f} {cy:.6f} {self.w:.6f} {self.h:.6f}"


@dataclass(frozen=True)
class Attributes:
    """Labels read straight from a human annotation instead of a class map."""

    report_type: str | None = None
    context: str | None = None
    materials: tuple[str, ...] = ()
    hazards: tuple[str, ...] = ()
    size_class: str | None = None
    brands: tuple[str, ...] = ()

    @staticmethod
    def from_json(raw: dict[str, Any]) -> Attributes:
        lists = {k: tuple(raw.get(k, ())) for k in ("materials", "hazards", "brands")}
        return Attributes(
            report_type=raw.get("report_type"),
            context=raw.get("context"),
            size_class=raw.get("size_class"),
            **lists,
        )


@dataclass(frozen=True)
class ImageRecord:
    """One image of one source, as written to `<cache>/<source>/records.jsonl`."""

    image_id: str
    source: str
    path: str
    labels: tuple[str, ...] = ()
    boxes: tuple[Box, ...] = ()
    attributes: Attributes | None = None
    group: str | None = None

    def to_json(self) -> dict[str, Any]:
        return asdict(self)

    @staticmethod
    def from_json(raw: dict[str, Any]) -> ImageRecord:
        attrs = raw.get("attributes")
        return ImageRecord(
            image_id=raw["image_id"],
            source=raw["source"],
            path=raw["path"],
            labels=tuple(raw.get("labels", ())),
            boxes=tuple(Box(**box) for box in raw.get("boxes", ())),
            attributes=Attributes.from_json(attrs) if attrs else None,
            group=raw.get("group"),
        )


@dataclass(frozen=True)
class ManifestRow:
    """One line of data/datasets/manifest.jsonl."""

    id: str
    source: str
    licence: str
    s3_key: str | None
    local_path: str | None
    report_type: str | None
    context: str | None = None
    materials: tuple[str, ...] = ()
    hazards: tuple[str, ...] = ()
    size_class: str | None = None
    brands: tuple[str, ...] = ()
    has_boxes: bool = False
    split: str | None = None
    # Rows sharing a group (one scan or one site) always land in the same split.
    group: str | None = None

    def with_split(self, split: str) -> ManifestRow:
        if split not in SPLITS:
            raise ConfigError(f"unknown split {split}")
        return replace(self, split=split)

    def to_json(self) -> dict[str, Any]:
        raw = asdict(self)
        for key in ("materials", "hazards", "brands"):
            raw[key] = list(raw[key])
        return raw

    @staticmethod
    def from_json(raw: dict[str, Any]) -> ManifestRow:
        values = {k: v for k, v in raw.items() if k in MANIFEST_FIELDS}
        for key in ("materials", "hazards", "brands"):
            values[key] = tuple(values.get(key, ()))
        return ManifestRow(**values)


MANIFEST_FIELDS = (
    "id", "source", "licence", "s3_key", "local_path", "report_type", "context",
    "materials", "hazards", "size_class", "brands", "has_boxes", "split", "group",
)
