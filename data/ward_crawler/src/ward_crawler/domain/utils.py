"""Small pure helpers for the domain."""

import re
from dataclasses import asdict

from ward_crawler.domain.values import FactValue


def squash(text: str) -> str:
    """Drop all whitespace and case so two copies of a snippet compare equal."""
    return "".join(text.split()).casefold()


def digit_runs(text: str) -> set[str]:
    """Numbers in the text, with Hindi and other decimal digits turned into 0-9."""
    plain = "".join(str(int(char)) if char.isdecimal() else char for char in text)
    plain = re.sub(r"(?<=[0-9]),(?=[0-9])", "", plain)  # 1,23,456 is one number
    return set(re.findall(r"[0-9]+", plain))


def fact_to_json(value: FactValue) -> object:
    if isinstance(value, str | int | float):
        return value
    return asdict(value)
