"""In-memory fakes of the crawler's ports. No network."""

import hashlib
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

from ward_crawler.domain.city import CityWards
from ward_crawler.domain.errors import ExtractionError, FetchError
from ward_crawler.domain.extraction import Extraction, ExtractionRequest, ModelCall
from ward_crawler.domain.layers import FeatureLayer
from ward_crawler.domain.sources import (
    BoundingBox,
    CitySources,
    MunicipalBody,
    Page,
    Source,
)
from ward_crawler.ports.map_layer_finder import MapLayerFinder
from ward_crawler.ports.page_fetcher import PageFetcher
from ward_crawler.ports.record_extractor import RecordExtractor
from ward_crawler.ports.record_store import RecordStore

SCHEMA = Path(__file__).resolve().parents[4] / "contracts" / "schemas" / "ward_record.schema.json"
BOX = BoundingBox(26.15, 72.90, 26.40, 73.15)


def make_page(url: str, text: str, hour: int = 10) -> Page:
    digest = hashlib.sha256(text.encode()).hexdigest()
    return Page(url, text, digest, datetime(2026, 10, 10, hour, 0, tzinfo=UTC))


def make_city(*sources: Source) -> CitySources:
    bodies = (
        MunicipalBody("jodhpur-uttar-mc", "Nagar Nigam Jodhpur Uttar"),
        MunicipalBody("jodhpur-dakshin-mc", "Nagar Nigam Jodhpur Dakshin"),
    )
    return CitySources("jodhpur", "Rajasthan", bodies, BOX, sources)


class FakePageFetcher(PageFetcher):
    def __init__(self, pages: dict[str, Page]) -> None:
        self._pages = pages
        self.asked: list[str] = []

    def fetch(self, url: str) -> Page:
        self.asked.append(url)
        if url not in self._pages:
            raise FetchError(f"ConnectTimeout: {url}")
        return self._pages[url]


class FakeRecordExtractor(RecordExtractor):
    """Answers each request with whatever the given function returns for its text."""

    def __init__(self, answer: Callable[[ExtractionRequest], Extraction | None]) -> None:
        self._answer = answer
        self.requests: list[ExtractionRequest] = []

    def extract(self, request: ExtractionRequest) -> Extraction:
        self.requests.append(request)
        extraction = self._answer(request)
        if extraction is None:
            raise ExtractionError("no model gave a valid answer")
        return extraction

    def usage(self) -> tuple[ModelCall, ...]:
        return ()


class FakeMapLayerFinder(MapLayerFinder):
    """Serves the given layers; any other kind fails as if Overpass were down."""

    def __init__(self, layers: tuple[FeatureLayer, ...] = ()) -> None:
        self._layers = {layer.kind: layer for layer in layers}

    def kinds(self) -> tuple[str, ...]:
        return ("disposal", "school")

    def find(self, kind: str, bbox: BoundingBox) -> FeatureLayer:
        if kind not in self._layers or bbox != BOX:
            raise FetchError("overpass unreachable")
        return self._layers[kind]

    def describe(self, kind: str) -> Source:
        return Source("https://overpass.example/api/interpreter", f"OSM {kind}", None)

    def attribution(self) -> str:
        return "(c) OpenStreetMap contributors, ODbL 1.0"


class FakeRecordStore(RecordStore):
    def __init__(self) -> None:
        self.saved: list[CityWards] = []

    def save(self, result: CityWards) -> str:
        self.saved.append(result)
        return f"memory://{result.city}"
