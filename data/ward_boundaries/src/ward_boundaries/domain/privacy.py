"""Keeps people out of stored text: honorifics, "X ji" and "X's house" style references."""

import re

REDACTED = "[a private place]"
_PERSON = re.compile(
    r"\b(shri|shree|smt|shrimati|sushri|kumari|mr|mrs|ms|miss|dr)\b\.?"
    r"|श्री|श्रीमती|सुश्री|डॉ"
    r"|\b\w+\s+ji\b"
    r"|\S+\s+जी(\s|$)"
    r"|\b\w+'s\s+(house|shop|farm|field|plot|well|haveli)\b",
    re.IGNORECASE,
)


class PersonGuard:
    def mentions_person(self, text: str) -> bool:
        return _PERSON.search(text) is not None

    def clean(self, text: str) -> str:
        """The whole text is replaced, so no part of a person's name survives."""
        return REDACTED if self.mentions_person(text) else text
