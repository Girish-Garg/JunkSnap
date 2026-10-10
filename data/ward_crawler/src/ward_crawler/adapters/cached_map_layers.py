"""Keeps the last OpenStreetMap layer per kind and box; reused while fresh or Overpass is down."""

import hashlib
import logging
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any

from ward_crawler.adapters.json_blobs import JsonBlobs
from ward_crawler.domain.errors import FetchError, UnsourcedFieldError
from ward_crawler.domain.layers import FeatureLayer, MapFeature
from ward_crawler.domain.provenance import Provenance
from ward_crawler.domain.sources import BoundingBox, Source
from ward_crawler.ports.map_layer_finder import MapLayerFinder

_log = logging.getLogger(__name__)


class CachedMapLayers(MapLayerFinder):
    def __init__(
        self,
        inner: MapLayerFinder,
        blobs: JsonBlobs,
        max_age: timedelta,
        now: Callable[[], datetime],
    ) -> None:
        self._inner = inner
        self._blobs = blobs
        self._max_age = max_age
        self._now = now

    def kinds(self) -> tuple[str, ...]:
        return self._inner.kinds()

    def find(self, kind: str, bbox: BoundingBox) -> FeatureLayer:
        key = self._key(kind, bbox)
        cached = self._read(key)
        if cached is not None and self._now() - cached.provenance.fetched_at < self._max_age:
            return cached
        try:
            layer = self._inner.find(kind, bbox)
        except FetchError as error:
            if cached is None:
                raise
            _log.warning("using the cached %s layer: %s", kind, error)
            return cached
        self._blobs.put(key, layer.to_json())
        return layer

    def describe(self, kind: str) -> Source:
        return self._inner.describe(kind)

    def attribution(self) -> str:
        return self._inner.attribution()

    def _key(self, kind: str, bbox: BoundingBox) -> str:
        box = f"{bbox.south},{bbox.west},{bbox.north},{bbox.east}"
        return f"layers/{kind}-{hashlib.sha256(box.encode()).hexdigest()[:16]}.json"

    def _read(self, key: str) -> FeatureLayer | None:
        saved = self._blobs.get(key)
        if saved is None:
            return None
        try:
            return self._layer(saved)
        except (KeyError, TypeError, ValueError, UnsourcedFieldError):
            return None

    def _layer(self, saved: Any) -> FeatureLayer:
        provenance = Provenance(
            saved["source_url"], datetime.fromisoformat(saved["fetched_at"]), saved["page_sha256"]
        )
        features = tuple(
            MapFeature(item["ref"], tuple((float(lat), float(lon)) for lat, lon in item["coords"]))
            for item in saved["features"]
        )
        return FeatureLayer(saved["kind"], provenance, features)
