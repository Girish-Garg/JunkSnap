"""Small pure helpers (10 lines or fewer each)."""

from collections.abc import Mapping
from types import MappingProxyType


def snake_word(value: object) -> str:
    """ "Dead Animal", "e-waste" and " Large " become dead_animal, e_waste and large."""
    text = value.strip().lower() if isinstance(value, str) else ""
    return "_".join(text.replace("-", " ").split())


def name_index(names: tuple[str, ...], synonyms: Mapping[str, frozenset[str]]) -> Mapping[str, str]:
    """Each synonym (as a snake_word) to its name; a name always means itself."""
    words = {snake_word(word): name for name, group in synonyms.items() for word in group}
    return MappingProxyType(words | {name: name for name in names})


def json_object_text(text: str) -> str:
    """The text from the first `{` to the last `}`, dropping code fences or chatter around it."""
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end < start:
        return text
    return text[start : end + 1]
