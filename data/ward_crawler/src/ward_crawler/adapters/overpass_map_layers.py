"""OpenStreetMap layers through the Overpass API (ODbL)."""

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from urllib.parse import quote

import httpx

from ward_crawler.adapters.host_throttle import HostThrottle
from ward_crawler.domain.errors import FetchError
from ward_crawler.domain.layers import FeatureLayer, MapFeature
from ward_crawler.domain.provenance import Provenance
from ward_crawler.domain.sources import BoundingBox, Source
from ward_crawler.ports.map_layer_finder import MapLayerFinder

ATTRIBUTION = "Map layers: (c) OpenStreetMap contributors, ODbL 1.0, openstreetmap.org/copyright"


@dataclass(frozen=True)
class OverpassLayer:
    """shape is "center" for places (one point each) or "geom" for lines and areas (vertices)."""

    kind: str
    selectors: tuple[str, ...]
    shape: str


DEFAULT_LAYERS = (
    OverpassLayer(
        "disposal",
        (
            'nwr["amenity"="waste_disposal"]',
            'nwr["amenity"="recycling"]',
            'nwr["amenity"="waste_transfer_station"]',
        ),
        "center",
    ),
    OverpassLayer("school", ('nwr["amenity"="school"]',), "center"),
    OverpassLayer("hospital", ('nwr["amenity"="hospital"]',), "center"),
    OverpassLayer("water", ('nw["natural"="water"]',), "geom"),
    OverpassLayer(
        "drain",
        ('way["waterway"="drain"]', 'way["waterway"="ditch"]', 'way["waterway"="stream"]'),
        "geom",
    ),
)


class OverpassMapLayers(MapLayerFinder):
    """Asks each Overpass endpoint in turn until one answers."""

    def __init__(
        self,
        client: httpx.Client,
        endpoints: tuple[str, ...],
        throttle: HostThrottle,
        layers: tuple[OverpassLayer, ...],
    ) -> None:
        self._client = client
        self._endpoints = endpoints
        self._throttle = throttle
        self._layers = {layer.kind: layer for layer in layers}
        self._answered_by = endpoints[0]

    def kinds(self) -> tuple[str, ...]:
        return tuple(self._layers)

    def find(self, kind: str, bbox: BoundingBox) -> FeatureLayer:
        query = self._query(self._layers[kind], bbox)
        errors: list[str] = []
        for endpoint in self._endpoints:
            try:
                layer = self._ask(endpoint, kind, query)
            except (httpx.HTTPError, ValueError, KeyError) as error:
                first_line = (str(error).splitlines() or [""])[0]
                errors.append(f"{endpoint}: {type(error).__name__}: {first_line}")
                continue
            self._answered_by = endpoint
            return layer
        raise FetchError("; ".join(errors) or "no Overpass endpoint configured")

    def describe(self, kind: str) -> Source:
        holds = f"OpenStreetMap layer {kind}: " + " or ".join(self._layers[kind].selectors)
        return Source(self._answered_by, holds, None)

    def attribution(self) -> str:
        return ATTRIBUTION

    def _query(self, layer: OverpassLayer, bbox: BoundingBox) -> str:
        box = f"({bbox.south},{bbox.west},{bbox.north},{bbox.east})"
        parts = "".join(f"{selector}{box};" for selector in layer.selectors)
        return f"[out:json][timeout:60];({parts});out skel {layer.shape};"

    def _ask(self, endpoint: str, kind: str, query: str) -> FeatureLayer:
        self._throttle.wait(endpoint)
        response = self._client.post(endpoint, data={"data": query})
        response.raise_for_status()
        elements = response.json()["elements"]
        provenance = Provenance(
            source_url=f"{endpoint}?data={quote(query)}",
            fetched_at=datetime.now(UTC),
            page_sha256=hashlib.sha256(response.content).hexdigest(),
        )
        return FeatureLayer(kind, provenance, tuple(self._feature(item) for item in elements))

    def _feature(self, element: dict[str, Any]) -> MapFeature:
        # Coordinates rounded to 5 decimals (about 1 m) to keep the files small.
        points = element.get("geometry") or [element.get("center", element)]
        coords = tuple((round(p["lat"], 5), round(p["lon"], 5)) for p in points if p)
        return MapFeature(f"osm:{element['type']}/{element['id']}", coords)
