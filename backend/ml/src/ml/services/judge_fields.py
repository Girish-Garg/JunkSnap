"""Lenient readers for the judge's optional insight fields (decision 20261010-0202).

A model that slips on one of them (a hazard outside the list, a share given as a percentage,
"Large", null for a list) loses that item, not its whole answer: an invalid answer would be
retried and could end as a judge outage although the claim itself parsed. Names are
lower-cased and read through the synonyms below; anything still unknown is dropped. The claim
attributes stay strict.
"""

import math
from collections.abc import Iterator, Mapping
from types import MappingProxyType

from ml.domain.insights import HAZARD_MIN, HAZARDS, MATERIALS, SIZE_CLASSES
from ml.domain.label_insights import MATERIAL_LABELS
from ml.utils import name_index, snake_word

BRANDS_MAX = 20
PERCENT = 100.0
# Label words that name no hazard or material when the judge writes them: ash is not fire,
# a mask is not medical waste, a barrel is not chemicals.
NOT_JUDGE_WORDS = frozenset({"ash", "mask", "barrel"})
# The judge's hazard synonyms, an explicit allow-list rather than the detectors' label lists.
# Only these fire words (and "burning") promote burning; decision 0202 lists "burning or smoke".
JUDGE_HAZARD_WORDS: Mapping[str, frozenset[str]] = MappingProxyType({
    "burning": frozenset({"smoke", "fire", "flame", "bonfire"}),
    "medical_waste": frozenset({"medicine", "pill", "syringe", "bandage"}),
    "e_waste": frozenset({"electronics", "computer", "monitor", "battery", "television"}),
    "dead_animal": frozenset({"carcass", "roadkill"}),
    "chemicals": frozenset({"chemical", "oil spill"}),
})
MATERIAL_NAMES = name_index(
    MATERIALS, {name: words - NOT_JUDGE_WORDS for name, words in MATERIAL_LABELS.items()}
)
HAZARD_NAMES = name_index(HAZARDS, JUDGE_HAZARD_WORDS)


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
        """(name, 0..1 number) for each object with a known name and a readable number.

        The scale is the list's: one value above 1 makes it all percent (70, 29, 1 is 1% glass).
        """
        rows = [
            (names.get(snake_word(item.get(keys[0]))), cls._number(item.get(keys[1])))
            for item in cls._items(value)
            if isinstance(item, dict)
        ]
        scale = PERCENT if any(number is not None and number > 1 for _, number in rows) else 1.0
        for name, number in rows:
            if name is not None and number is not None and number <= scale:
                yield name, number / scale

    @staticmethod
    def _items(value: object) -> list[object]:
        """A list as given; null or anything else is empty."""
        return list(value) if isinstance(value, list | tuple) else []

    @staticmethod
    def _number(value: object) -> float | None:
        """A finite number of 0 or more (a numeric string too); anything else is unreadable."""
        if isinstance(value, bool) or not isinstance(value, int | float | str):
            return None
        try:
            number = float(value)
        except ValueError:
            return None
        return number if math.isfinite(number) and number >= 0 else None
