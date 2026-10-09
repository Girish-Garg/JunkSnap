"""Keeps a fact only when every value in it is shown, whole, where it claims to come from."""

from ward_crawler.domain.sources import Page
from ward_crawler.domain.utils import fact_to_json, token_line
from ward_crawler.domain.values import FactValue


class FactCheck:
    def __init__(self, page: Page) -> None:
        self._page = page

    def holds(self, value: FactValue, window: str | None) -> bool:
        """Each text or number must appear unbroken: in the window if given, else on the page."""
        texts = [self._as_text(leaf) for leaf in self._leaves(fact_to_json(value))]
        if window is None:
            return all(self._page.shows(text) for text in texts)
        scope = token_line(window)
        return all(bool(token_line(text)) and token_line(text) in scope for text in texts)

    def _as_text(self, leaf: object) -> str:
        return f"{leaf:g}" if isinstance(leaf, float) else str(leaf)

    def _leaves(self, data: object) -> list[object]:
        if isinstance(data, dict):
            return [
                leaf for item in data.values() if item is not None for leaf in self._leaves(item)
            ]
        return [data]
