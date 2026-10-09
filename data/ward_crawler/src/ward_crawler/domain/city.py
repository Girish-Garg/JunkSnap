"""The crawl result for one city: ward records, map layers and a log of every source tried."""

from collections import Counter
from dataclasses import dataclass
from datetime import datetime

from ward_crawler.domain.layers import FeatureLayer
from ward_crawler.domain.sources import Page, Source
from ward_crawler.domain.utils import utc_z
from ward_crawler.domain.ward import FACT_FIELDS, WardRecord


@dataclass(frozen=True)
class SourceOutcome:
    source: Source
    status: str
    detail: str
    page: Page | None = None
    wards_found: int = 0

    def to_json(self) -> dict[str, object]:
        page = self.page.provenance().to_json() if self.page else {}
        return {
            "url": self.source.url,
            "holds": self.source.holds,
            "status": self.status,
            "detail": self.detail,
            "wards_found": self.wards_found,
            "fetched_at": page.get("fetched_at"),
            "page_sha256": page.get("page_sha256"),
        }


@dataclass(frozen=True)
class CityWards:
    """Everything written to data/wards/<city>.json. Always unreviewed until a human checks it."""

    city: str
    state: str
    generated_at: datetime
    records: tuple[WardRecord, ...]
    layers: tuple[FeatureLayer, ...]
    sources: tuple[SourceOutcome, ...]
    attribution: str
    rejected: tuple[str, ...] = ()
    note: str = ""

    def field_counts(self) -> dict[str, int]:
        counts: Counter[str] = Counter()
        for record in self.records:
            counts.update(record.filled_fields())
        return {name: counts[name] for name in (*FACT_FIELDS, "disposal_points")}

    def to_json(self) -> dict[str, object]:
        return {
            "city": self.city,
            "state": self.state,
            "generated_at": utc_z(self.generated_at),
            "review_status": "unreviewed",
            "note": self.note,
            "attribution": self.attribution,
            "sources": [outcome.to_json() for outcome in self.sources],
            "records": [record.to_json() for record in self.records],
            "rejected_records": list(self.rejected),
            "map_layers": [layer.to_json() for layer in self.layers],
        }
