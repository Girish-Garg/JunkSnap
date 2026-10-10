"""Deterministic fallback: a hand-checked regex that reads ward rows straight off a page."""

import hashlib
import re
from dataclasses import dataclass

from ward_crawler.domain.extraction import ExtractedWard
from ward_crawler.domain.sources import Page
from ward_crawler.domain.values import FactValue, Population
from ward_crawler.domain.ward import ModelInfo


@dataclass(frozen=True)
class RowPattern:
    """Named groups: `ward` (required), and any of `population`, `zone`, `ward_name`."""

    regex: str

    def model(self) -> ModelInfo:
        digest = hashlib.sha256(self.regex.encode()).hexdigest()[:12]
        return ModelInfo("junksnap", "row-pattern", digest)

    def wards(self, page: Page, body: str) -> tuple[ExtractedWard, ...]:
        found: dict[int, ExtractedWard] = {}
        for match in re.finditer(self.regex, page.text):
            number = int(match["ward"])
            if number not in found:
                found[number] = ExtractedWard(body, number, match[0], self._facts(match))
        return tuple(found.values())

    def _facts(self, match: re.Match[str]) -> dict[str, FactValue]:
        groups = {name: value for name, value in match.groupdict().items() if value}
        facts: dict[str, FactValue] = {}
        if "population" in groups:
            facts["population"] = Population(int(groups["population"]), None)
        for name in ("zone", "ward_name"):
            if name in groups:
                facts[name] = " ".join(groups[name].split())
        return facts
