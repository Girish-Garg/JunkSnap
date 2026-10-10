"""Reads ward lists out of source texts and cross-checks them against each other."""

import re
from dataclasses import replace

from ward_boundaries.domain.models import Document, WardEvidence, WardText

_LIST_HEADING = re.compile(r"(?m)^\s*वार्ड\s*(\d{1,3})\s*$")
_PARTIAL = re.compile(r"\(?\s*आंशिक\s*\)?")
# Gazette rows: "<n> ... सीमा <population>" or "सीमा <population>" on the line above "<n>".
_GAZETTE_ROWS = (
    re.compile(r"(?m)^\s*(?P<ward>\d{1,3})\s+(?:\S.*?)?सीमा\s+(?P<population>\d{4,6})\s*$"),
    re.compile(r"सीमा\s+(?P<population>\d{4,6})\s*\n\s*(?P<ward>\d{1,3})\s"),
)


class LocalityList:
    """A list like "वार्ड 12" followed by its comma-separated localities (newspaper copy)."""

    def parse(self, document: Document) -> dict[int, WardText]:
        headings = list(_LIST_HEADING.finditer(document.text))
        wards: dict[int, WardText] = {}
        for heading, following in zip(headings, [*headings[1:], None], strict=True):
            end = following.start() if following else len(document.text)
            body = document.text[heading.end() : end].strip().split("\n")[0]
            number = int(heading.group(1))
            wards.setdefault(number, WardText(number, self._places(body), None, document))
        return wards

    def _places(self, body: str) -> tuple[str, ...]:
        parts = re.split(r"[,।;]", _PARTIAL.sub(" ", body))
        names = (" ".join(part.split()) for part in parts)
        return tuple(dict.fromkeys(name for name in names if len(name) > 1))


class GazetteRows:
    """Ward numbers and populations from the gazette's boundary table (garbled PDF text)."""

    def parse(self, document: Document) -> dict[int, WardText]:
        wards: dict[int, WardText] = {}
        for pattern in _GAZETTE_ROWS:
            for match in pattern.finditer(document.text):
                number, population = int(match["ward"]), int(match["population"])
                wards.setdefault(number, WardText(number, (), population, document))
        return wards


class WardCrossCheck:
    """Joins sources per ward: the gazette gives numbers, the list gives readable places."""

    def combine(
        self, gazette: dict[int, WardText], localities: dict[int, WardText], expected: int
    ) -> tuple[WardEvidence, ...]:
        evidence = []
        for number in range(1, expected + 1):
            listed, official = localities.get(number), gazette.get(number)
            notes = self._notes(listed, official)
            sources = tuple(dict.fromkeys(t.source for t in (official, listed) if t is not None))
            places = listed.places if listed else ()
            population = official.population if official else None
            models = tuple(dict.fromkeys(m for t in (official, listed) if t for m in t.models))
            ward = WardEvidence(
                number, places, (), population, sources, notes, official is not None
            )
            ward = replace(ward, models=models)
            evidence.append(ward)
        return tuple(evidence)

    def _notes(self, listed: WardText | None, official: WardText | None) -> tuple[str, ...]:
        if listed and official and listed.source == official.source:
            return ("places read from the official gazette text",)
        if listed and official:
            return ("ward listed in the gazette copy and the locality list",)
        if official:
            return ("ward in the gazette copy only; no readable locality list",)
        if listed:
            return ("ward row not read from the gazette copy; places from the locality list only",)
        return ("ward found in no source",)
