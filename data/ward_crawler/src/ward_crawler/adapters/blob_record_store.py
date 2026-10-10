"""Writes a city's crawl result to wards/<city>.json in the crawl store (S3 crawl/wards/)."""

from ward_crawler.adapters.json_blobs import JsonBlobs
from ward_crawler.domain.city import CityWards
from ward_crawler.ports.record_store import RecordStore


class BlobRecordStore(RecordStore):
    """Records are unreviewed; reviewed copies stay in git data/wards, read by the server too."""

    def __init__(self, blobs: JsonBlobs) -> None:
        self._blobs = blobs

    def save(self, result: CityWards) -> str:
        return self._blobs.put(self.key(result.city), result.to_json())

    def key(self, city: str) -> str:
        return f"wards/{city}.json"
