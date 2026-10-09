"""Small pure helpers for the domain."""

import re
import unicodedata
from dataclasses import asdict
from datetime import UTC, datetime

from ward_crawler.domain.values import FactValue

# A number keeps its decimal point (2.5 stays one token); words split at spaces and punctuation.
_TOKEN = re.compile(r"[0-9]+(?:\.[0-9]+)*|[^\s|,;:()\[\]{}'\"\-–/.]+")
_JOIN = "\x1f"
# Text with an honorific is naming a person.
_HONORIFIC = re.compile(
    r"\b(shri|shree|smt|shrimati|sushri|kumari|mr|mrs|ms|miss|dr)\b|श्री|श्रीमती|सुश्री|डॉ",
    re.IGNORECASE,
)


def squash(text: str) -> str:
    """Drop all whitespace and case so two copies of a snippet compare equal."""
    return "".join(text.split()).casefold()


def token_line(text: str) -> str:
    """Casefolded tokens joined by a separator, so `in` matches whole tokens in a row."""
    found = _TOKEN.findall(ascii_digits(text).casefold())
    return _JOIN + _JOIN.join(found) + _JOIN if found else ""


def ascii_digits(text: str) -> str:
    """Hindi and other decimal digits as 0-9; 1,23,456 written as 123456."""
    plain = "".join(str(int(char)) if char.isdecimal() else char for char in text)
    return re.sub(r"(?<=[0-9]),(?=[0-9])", "", plain)


def digit_runs(text: str) -> set[str]:
    return set(re.findall(r"[0-9]+", ascii_digits(text)))


def ward_window(text: str, number: int) -> str:
    """The part of a snippet from the ward's number up to the next row's number (n-1 or n+1)."""
    plain = ascii_digits(text)
    start = re.search(rf"(?<![0-9]){number}(?![0-9])", plain)
    if start is None:
        return ""
    end = re.compile(rf"(?<![0-9])({number - 1}|{number + 1})(?![0-9])").search(plain, start.end())
    return plain[start.start() : end.start() if end else len(plain)]


def looks_garbled(text: str) -> bool:
    """PDF extraction slips: a word that starts with a vowel sign, or glyphs outside Devanagari."""
    starts = any(unicodedata.category(word[0]) in ("Mn", "Mc") for word in text.split())
    stray = any(not (char.isascii() or "ऀ" <= char <= "ॿ") for char in text)
    return starts or stray


def has_honorific(text: str) -> bool:
    return _HONORIFIC.search(text) is not None


def utc_z(moment: datetime) -> str:
    return moment.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def fact_to_json(value: FactValue) -> object:
    if isinstance(value, str | int | float):
        return value
    return asdict(value)
