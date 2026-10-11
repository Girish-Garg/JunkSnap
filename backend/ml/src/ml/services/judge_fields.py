"""Lenient readers for the judge's optional insight fields (decision 20261010-0202).

A model that slips on one of them (a hazard outside the list, a share given as a percentage,
"Large", null for a list) loses that item, not its whole answer: an invalid answer would be
retried and could end as a judge outage although the claim itself parsed. Names are
lower-cased and read through the label keyword lists ("smoke" is burning, as decision 0202
lists "burning or smoke"); anything still unknown is dropped. The claim attributes stay strict.
"""

import math
from collections.abc import Iterator, Mapping

from ml.domain.insights import HAZARD_MIN, HAZARDS, MATERIALS, SIZE_CLASSES
from ml.domain.label_insights import HAZARD_LABELS, MATERIAL_LABELS
from ml.utils import name_index, snake_word

BRANDS_MAX = 20
PERCENT = 100.0
MATERIAL_NAMES = name_index(MATERIALS, MATERIAL_LABELS)
HAZARD_NAMES = name_index(HAZARDS, HAZARD_LABELS)


class JudgeInsightFields:
    """Pydantic BeforeValidators: each turns a raw field into what the strict model accepts."""

    @staticmethod
    def brands(value: object) -> tuple[str, ...]:
        texts = (item.strip() for item in JudgeInsightFields._items(value) if isinstance(item, str))
        return tuple(text for text in texts if text)[:BRANDS_MAX]

    @staticmethod
    def size_class(value: object) -> str | None:
        """A known size, else null ("none", "huge", a number)."""
        word = snake_word(value)
        return word if word in SIZE_CLASSES else None

    @classmethod
    def composition(cls, value: object) -> list[dict[str, object]]:
        entries = cls._entries(value, ("material", "share"), MATERIAL_NAMES)
        return [{"material": name, "share": share} for name, share in entries][: len(MATERIALS)]

    @classmethod
    def hazards(cls, value: object) -> list[dict[str, object]]:
        return [{"hazard": name, "confidence": conf} for name, conf in cls.sure(value).items()]

    @classmethod
    def sure(cls, value: object) -> dict[str, float]:
        """Each hazard at its highest confidence, kept only at HAZARD_MIN or more."""
        best: dict[str, float] = {}
        for name, confidence in cls._entries(value, ("hazard", "confidence"), HAZARD_NAMES):
            if confidence >= HAZARD_MIN:
                best[name] = max(best.get(name, 0.0), confidence)
        return best

    @classmethod
    def _entries(
        cls, value: object, keys: tuple[str, str], names: Mapping[str, str]
    ) -> Iterator[tuple[str, float]]:
        """(name, 0..1 number) for each object with a known name and a readable number."""
        for item in cls._items(value):
            if not isinstance(item, dict):
                continue
            name = names.get(snake_word(item.get(keys[0])))
            number = cls._fraction(item.get(keys[1]))
            if name is not None and number is not None:
                yield name, number

    @staticmethod
    def _items(value: object) -> list[object]:
        """A list as given; null or anything else is empty."""
        return list(value) if isinstance(value, list | tuple) else []

    @staticmethod
    def _fraction(value: object) -> float | None:
        """0..1 as given, above 1 up to 100 a percentage; anything else is unreadable."""
        if isinstance(value, bool) or not isinstance(value, int | float | str):
            return None
        try:
            number = float(value)
        except ValueError:
            return None
        if math.isnan(number) or not 0 <= number <= PERCENT:
            return None
        return number / PERCENT if number > 1 else number
