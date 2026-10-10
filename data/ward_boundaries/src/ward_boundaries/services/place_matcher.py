"""Finds the mapped places a ward's listed localities name."""

import re
from collections import defaultdict
from dataclasses import replace
from difflib import SequenceMatcher, get_close_matches

from ward_boundaries.domain.models import Place, WardEvidence

FUZZY_CUTOFF = 0.95
MIN_KEY = 5
MIN_WORD = 4
WORD_CUTOFF = 0.84
MAX_SPREAD_KM = 1.5
# Words dropped before matching: they say nothing about where a place is.
_FILLER = {"area", "the", "of", "near", "aas", "paas", "kshetra", "aanshik"}
# Words that never pin a place down on their own (a girls' school, a sector, a market).
# fmt: off
_COMMON = {
    "nagar", "colony", "school", "girls", "boys", "office", "nigam", "mandir", "temple",
    "market", "hospital", "sector", "chowk", "bas", "basti", "ka", "ki", "ke", "bagh", "park",
    "talab", "sagar", "gate", "pol", "bazar", "mohalla", "scheme", "yojana", "new",
    "industrial", "housing", "board", "bhawan", "bhavan", "community", "government", "public",
    "primary", "secondary", "senior", "upper", "higher", "vidyalaya", "residential", "awasiya",
    "balaji", "ganesh", "hanuman", "ramdev", "shiv", "mata", "devi", "road", "gali", "lane",
}
# fmt: on


class PlaceMatcher:
    """Named places match a locality by (almost) equal name, addressed places (polling stations)
    when their name holds it as whole words. A place claimed by two wards is dropped from both."""

    def __init__(
        self, named: tuple[Place, ...], addressed: tuple[Place, ...], english: dict[str, str]
    ) -> None:
        self._english = english
        self._index: dict[str, list[Place]] = defaultdict(list)
        for place in named:
            self._index[self.normalize(place.name)].append(place)
        self._keys = list(self._index)
        self._addressed = [(f" {self.normalize(p.name)} ", p) for p in (*addressed, *named)]

    def normalize(self, name: str) -> str:
        words = re.findall(r"\w+", name.casefold())
        return " ".join(word for word in words if word not in _FILLER)

    def match(self, wards: tuple[WardEvidence, ...]) -> tuple[WardEvidence, ...]:
        found = {ward.number: self._candidates(ward) for ward in wards}
        owners: dict[str, set[int]] = defaultdict(set)
        for number, pairs in found.items():
            for _, place in pairs:
                owners[place.ref].add(number)
        return tuple(
            replace(
                ward, matched=tuple(p for p in found[ward.number] if len(owners[p[1].ref]) == 1)
            )
            for ward in wards
        )

    def _candidates(self, ward: WardEvidence) -> tuple[tuple[str, Place], ...]:
        pairs: list[tuple[str, Place]] = []
        for listed in ward.listed:
            found = [
                p for name in (listed, self._english.get(listed, "")) for p in self._places(name)
            ]
            if self._compact(found):
                pairs.extend((listed, place) for place in found)
        return tuple(dict.fromkeys(pairs))

    def _compact(self, places: list[Place]) -> bool:
        """A name found at spots far apart (a Subhash Chowk in every quarter) says nothing."""
        return all(
            abs(a.lat - b.lat) * 111.0 + abs(a.lon - b.lon) * 100.0 <= MAX_SPREAD_KM
            for a in places
            for b in places
        )

    def _places(self, name: str) -> list[Place]:
        wanted = self.normalize(name)
        if len(wanted) < MIN_KEY or not self._distinctive(wanted):
            return []
        exact = wanted if wanted in self._index else None
        close = exact or next(iter(get_close_matches(wanted, self._keys, 1, FUZZY_CUTOFF)), None)
        named = self._index[close] if close else []
        addressed = [place for text, place in self._addressed if self._holds(text, wanted)]
        return [*named, *addressed]

    def _distinctive(self, wanted: str) -> bool:
        return any(
            w not in _COMMON and len(w) >= MIN_WORD and not w.isnumeric() for w in wanted.split()
        )

    def _holds(self, text: str, wanted: str) -> bool:
        """Whole words in a row; distinctive words may differ slightly (Basni / Basani)."""
        if f" {wanted} " in text:
            return True
        words, wanted_words = text.split(), wanted.split()
        size = len(wanted_words)
        return any(
            all(self._same(a, b) for a, b in zip(words[i : i + size], wanted_words, strict=True))
            for i in range(len(words) - size + 1)
        )

    def _same(self, seen: str, wanted: str) -> bool:
        if seen == wanted:
            return True
        if wanted in _COMMON or wanted.isnumeric() or len(wanted) < MIN_WORD + 2:
            return False
        close = SequenceMatcher(None, seen, wanted).ratio() >= WORD_CUTOFF
        return seen[0] == wanted[0] and close
