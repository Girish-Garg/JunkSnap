"""Where a fact came from: the page URL, when it was fetched and the page's SHA-256."""

import re
from dataclasses import dataclass
from datetime import datetime

from ward_crawler.domain.errors import UnsourcedFieldError
from ward_crawler.domain.utils import fact_to_json
from ward_crawler.domain.values import FactValue

_SHA256 = re.compile(r"^[0-9a-f]{64}$")


@dataclass(frozen=True)
class Provenance:
    source_url: str
    fetched_at: datetime
    page_sha256: str

    def __post_init__(self) -> None:
        if not self.source_url.startswith(("http://", "https://")):
            raise UnsourcedFieldError(f"fact has no source URL: {self.source_url!r}")
        if self.fetched_at.tzinfo is None:
            raise UnsourcedFieldError("fetched_at must carry a time zone")
        if not _SHA256.match(self.page_sha256):
            raise UnsourcedFieldError(f"page_sha256 is not a SHA-256: {self.page_sha256!r}")

    def is_newer_than(self, other: "Provenance") -> bool:
        return self.fetched_at > other.fetched_at

    def to_json(self) -> dict[str, str]:
        return {
            "source_url": self.source_url,
            "fetched_at": self.fetched_at.isoformat(timespec="seconds"),
            "page_sha256": self.page_sha256,
        }


@dataclass(frozen=True)
class Sourced:
    value: FactValue
    provenance: Provenance

    def newest(self, other: "Sourced | None") -> "Sourced":
        """Return whichever fact was fetched last; ties keep this one."""
        if other is not None and other.provenance.is_newer_than(self.provenance):
            return other
        return self

    def to_json(self) -> dict[str, object]:
        return {"value": fact_to_json(self.value), **self.provenance.to_json()}
