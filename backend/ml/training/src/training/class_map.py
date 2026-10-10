"""Maps source dataset classes to JunkSnap report types, materials, hazards and detector classes."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from training.domain import Attributes, ConfigError, ImageRecord


@dataclass(frozen=True)
class ClassRule:
    report_type: str | None = None
    materials: tuple[str, ...] = ()
    hazards: tuple[str, ...] = ()
    yolo: str | None = None

    @staticmethod
    def from_json(raw: dict[str, Any]) -> ClassRule:
        return ClassRule(
            report_type=raw.get("report_type"),
            materials=tuple(raw.get("materials", ())),
            hazards=tuple(raw.get("hazards", ())),
            yolo=raw.get("yolo"),
        )


@dataclass(frozen=True)
class Vocabulary:
    """Allowed values; the order of report_types is the priority when labels disagree."""

    report_types: tuple[str, ...]
    contexts: dict[str, tuple[str, ...]]
    materials: tuple[str, ...]
    hazards: tuple[str, ...]
    size_classes: tuple[str, ...]
    yolo_classes: tuple[str, ...]

    @staticmethod
    def from_json(raw: dict[str, Any]) -> Vocabulary:
        return Vocabulary(
            report_types=tuple(raw["report_types"]),
            contexts={k: tuple(v) for k, v in raw["contexts"].items()},
            materials=tuple(raw["materials"]),
            hazards=tuple(raw["hazards"]),
            size_classes=tuple(raw["size_classes"]),
            yolo_classes=tuple(raw["yolo_classes"]),
        )

    def check_rule(self, where: str, rule: ClassRule) -> None:
        self._check(where, (rule.report_type,), (*self.report_types, None))
        self._check(where, rule.materials, self.materials)
        self._check(where, rule.hazards, self.hazards)
        self._check(where, (rule.yolo,), (*self.yolo_classes, None))

    def check_attributes(self, where: str, attrs: Attributes) -> None:
        self._check(where, (attrs.report_type,), (*self.report_types, None))
        self._check(where, attrs.materials, self.materials)
        self._check(where, attrs.hazards, self.hazards)
        self._check(where, (attrs.size_class,), (*self.size_classes, None))
        allowed = self.contexts.get(attrs.report_type or "", ())
        self._check(where, (attrs.context,), (*allowed, None))

    @staticmethod
    def _check(where: str, values: tuple[str | None, ...], allowed: tuple[str | None, ...]) -> None:
        bad = [v for v in values if v not in allowed]
        if bad:
            raise ConfigError(f"{where}: unknown value(s) {bad}")


@dataclass(frozen=True)
class SourceRules:
    default: ClassRule
    classes: dict[str, ClassRule]


class ClassMap:
    """Turns an ImageRecord's source labels into JunkSnap attributes."""

    def __init__(self, vocabulary: Vocabulary, sources: dict[str, SourceRules]) -> None:
        self._vocab = vocabulary
        self._sources = sources
        for name, rules in sources.items():
            vocabulary.check_rule(f"{name}.default", rules.default)
            for label, rule in rules.classes.items():
                vocabulary.check_rule(f"{name}.{label}", rule)

    @staticmethod
    def load(path: Path) -> ClassMap:
        raw = json.loads(path.read_text(encoding="utf-8"))
        sources = {
            name: SourceRules(
                default=ClassRule.from_json(spec.get("default", {})),
                classes={k: ClassRule.from_json(v) for k, v in spec["classes"].items()},
            )
            for name, spec in raw["sources"].items()
        }
        return ClassMap(Vocabulary.from_json(raw["vocabulary"]), sources)

    @property
    def vocabulary(self) -> Vocabulary:
        return self._vocab

    def attributes_for(self, record: ImageRecord) -> Attributes:
        if record.attributes is not None:
            self._vocab.check_attributes(record.image_id, record.attributes)
            return record.attributes
        labels = (*record.labels, *(box.label for box in record.boxes))
        rules = [self._rule(record.source, label) for label in dict.fromkeys(labels)]
        return Attributes(
            report_type=self._report_type(record, rules),
            materials=self._ordered(rules, "materials", self._vocab.materials),
            hazards=self._ordered(rules, "hazards", self._vocab.hazards),
        )

    def yolo_class(self, source: str, label: str) -> str | None:
        return self._rule(source, label).yolo or self._source(source).default.yolo

    def _rule(self, source: str, label: str) -> ClassRule:
        rules = self._source(source)
        if label not in rules.classes:
            raise ConfigError(f"class_map has no rule for {source}.{label}")
        return rules.classes[label]

    def _source(self, source: str) -> SourceRules:
        if source not in self._sources:
            raise ConfigError(f"class_map has no source {source}")
        return self._sources[source]

    def _report_type(self, record: ImageRecord, rules: list[ClassRule]) -> str | None:
        found = [r.report_type for r in rules if r.report_type is not None]
        if not found:
            return self._source(record.source).default.report_type
        return min(found, key=self._vocab.report_types.index)

    @staticmethod
    def _ordered(rules: list[ClassRule], attr: str, order: tuple[str, ...]) -> tuple[str, ...]:
        found = {value for rule in rules for value in getattr(rule, attr)}
        return tuple(v for v in order if v in found)
