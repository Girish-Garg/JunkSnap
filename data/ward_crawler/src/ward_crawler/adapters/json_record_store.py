"""Writes a city's crawl result to data/wards/<city>.json."""

import json
from pathlib import Path

from ward_crawler.domain.city import CityWards
from ward_crawler.domain.errors import StoreError
from ward_crawler.ports.record_store import RecordStore


class JsonRecordStore(RecordStore):
    """Refuses to overwrite a file in which a person has already reviewed records."""

    def __init__(self, out_dir: Path, overwrite_reviewed: bool = False) -> None:
        self._out_dir = out_dir
        self._overwrite_reviewed = overwrite_reviewed

    def save(self, result: CityWards) -> str:
        path = self._out_dir / f"{result.city}.json"
        if not self._overwrite_reviewed and self._has_reviews(path):
            raise StoreError(f"{path} has reviewed records; rerun with --overwrite-reviewed")
        self._out_dir.mkdir(parents=True, exist_ok=True)
        text = json.dumps(result.to_json(), ensure_ascii=False, indent=1)
        path.write_text(text + "\n", encoding="utf-8", newline="\n")
        return str(path)

    def _has_reviews(self, path: Path) -> bool:
        if not path.exists():
            return False
        records = json.loads(path.read_text(encoding="utf-8")).get("records", [])
        return any(record.get("review_status") != "unreviewed" for record in records)
