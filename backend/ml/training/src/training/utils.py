"""Small pure helpers."""

from __future__ import annotations

import hashlib
import zipfile
from collections import Counter
from collections.abc import Callable, Iterable

S3_PREFIX = "datasets"


def safe_stem(text: str) -> str:
    """Turns a path inside an archive into a flat, filesystem-safe file stem."""
    keep = [c if c.isalnum() else "_" for c in text.rsplit(".", 1)[0].lower()]
    return "".join(keep).strip("_")[:80]


def count_values(values: Iterable[str]) -> dict[str, int]:
    """Counts as a key-sorted dict, so committed summaries diff cleanly."""
    return dict(sorted(Counter(values).items()))


def short_hash(text: str) -> str:
    """Keeps stems unique when names differ only by case or extension."""
    return hashlib.sha256(text.encode()).hexdigest()[:8]


def evenly_spaced[T](items: list[T], limit: int | None) -> list[T]:
    """A fixed, spread-out subset so a capped fetch is reproducible."""
    if limit is None or len(items) <= limit:
        return items
    step = len(items) / limit
    return [items[int(i * step)] for i in range(limit)]


def s3_key(relative: str) -> str:
    """Dataset files live under one prefix of the private bucket."""
    return f"{S3_PREFIX}/{relative}"


def zip_reader(zf: zipfile.ZipFile, member: str) -> Callable[[], bytes]:
    """Defers reading one archive member until the image is needed."""
    return lambda: zf.read(member)
