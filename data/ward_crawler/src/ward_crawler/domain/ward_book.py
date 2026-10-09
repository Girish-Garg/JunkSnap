"""Collects ward records and merges the ones that describe the same ward."""

from ward_crawler.domain.ward import WardKey, WardRecord


class WardBook:
    def __init__(self) -> None:
        self._records: dict[WardKey, WardRecord] = {}

    def add(self, record: WardRecord) -> None:
        known = self._records.get(record.key)
        self._records[record.key] = record if known is None else known.merged_with(record)

    def records(self) -> tuple[WardRecord, ...]:
        return tuple(sorted(self._records.values(), key=lambda record: record.key.id))
