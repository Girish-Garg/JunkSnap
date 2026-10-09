"""Keeps a fact only when its words and numbers can be found on the page it cites."""

from ward_crawler.domain.sources import Page
from ward_crawler.domain.utils import digit_runs, fact_to_json
from ward_crawler.domain.values import FactValue


class FactCheck:
    def __init__(self, page: Page) -> None:
        self._page = page
        self._digits = digit_runs(page.text)

    def holds(self, value: FactValue) -> bool:
        leaves = self._leaves(fact_to_json(value))
        numbers = set().union(*(digit_runs(str(leaf)) for leaf in leaves))
        words = [leaf for leaf in leaves if isinstance(leaf, str)]
        return numbers <= self._digits and all(self._page.mentions(word) for word in words)

    def _leaves(self, data: object) -> list[object]:
        if isinstance(data, dict):
            return [
                leaf for item in data.values() if item is not None for leaf in self._leaves(item)
            ]
        return [data]
