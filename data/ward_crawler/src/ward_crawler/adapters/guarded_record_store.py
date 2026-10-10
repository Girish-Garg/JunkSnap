"""Refuses to replace the last good crawl output with an empty or smaller one."""

from ward_crawler.adapters.blob_record_store import BlobRecordStore
from ward_crawler.adapters.json_blobs import JsonBlobs
from ward_crawler.domain.city import CityWards
from ward_crawler.domain.errors import StoreError
from ward_crawler.ports.record_store import RecordStore


class GuardedRecordStore(RecordStore):
    """A refusal raises StoreError, so the crawl job marks the district failed and retries it."""

    def __init__(self, inner: BlobRecordStore, blobs: JsonBlobs) -> None:
        self._inner = inner
        self._blobs = blobs

    def save(self, result: CityWards) -> str:
        if not any(outcome.page is not None for outcome in result.sources):
            raise StoreError(f"{result.city}: no official page was fetched; kept the last output")
        saved = self._blobs.get(self._inner.key(result.city))
        if isinstance(saved, dict):
            self._check_not_smaller(result, saved)
        return self._inner.save(result)

    def _check_not_smaller(self, result: CityWards, saved: dict[str, object]) -> None:
        records = saved.get("records")
        before = len(records) if isinstance(records, list) else 0
        if len(result.records) < before:
            raise StoreError(
                f"{result.city}: {len(result.records)} ward record(s), fewer than the "
                f"{before} already stored; kept the last output"
            )
        layers = saved.get("map_layers")
        kinds = (
            {layer.get("kind") for layer in layers if isinstance(layer, dict)}
            if isinstance(layers, list)
            else set()
        )
        missing = kinds - {layer.kind for layer in result.layers}
        if missing:
            raise StoreError(
                f"{result.city}: map layers {sorted(map(str, missing))} not fetched; "
                "kept the last output"
            )
