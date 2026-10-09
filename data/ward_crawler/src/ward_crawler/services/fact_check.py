"""Keeps a fact only when its words and numbers can be found where it claims to come from."""

from ward_crawler.domain.sources import Page
from ward_crawler.domain.utils import digit_runs, fact_to_json, words
from ward_crawler.domain.values import FactValue


class FactCheck:
    def __init__(self, page: Page) -> None:
        self._page = page
        self._digits = digit_runs(page.text)

    def holds(self, value: FactValue, window: str | None) -> bool:
        """With a window (the ward's own row), every word and number must be in it."""
        leaves = self._leaves(fact_to_json(value))
        numbers = set().union(*(digit_runs(str(leaf)) for leaf in leaves))
        texts = [leaf for leaf in leaves if isinstance(leaf, str)]
        if window is None:
            return numbers <= self._digits and all(self._page.mentions(text) for text in texts)
        return numbers <= digit_runs(window) and all(words(text) <= words(window) for text in texts)

    def _leaves(self, data: object) -> list[object]:
        if isinstance(data, dict):
            return [
                leaf for item in data.values() if item is not None for leaf in self._leaves(item)
            ]
        return [data]
