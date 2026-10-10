"""Runs a city's crawl: sources, pages, extraction, merge, validation, then save."""

from datetime import UTC, datetime

from ward_crawler.domain.city import CityWards, SourceOutcome
from ward_crawler.domain.errors import FetchError, InvalidRecordError
from ward_crawler.domain.layers import FeatureLayer
from ward_crawler.domain.sources import CitySources
from ward_crawler.domain.ward import WardRecord
from ward_crawler.domain.ward_book import WardBook
from ward_crawler.ports.map_layer_finder import MapLayerFinder
from ward_crawler.ports.record_store import RecordStore
from ward_crawler.ports.record_validator import RecordValidator
from ward_crawler.services.source_reader import SourceReader


class WardCrawlService:
    def __init__(
        self,
        reader: SourceReader,
        finder: MapLayerFinder,
        validator: RecordValidator,
        store: RecordStore,
    ) -> None:
        self._reader = reader
        self._finder = finder
        self._validator = validator
        self._store = store

    def run(self, city: CitySources) -> CityWards:
        book = WardBook()
        outcomes: list[SourceOutcome] = []
        for source in city.sources:
            records, outcome = self._reader.read(city, source)
            for record in records:
                book.add(record)
            outcomes.append(outcome)
        valid, rejected = self._validate(book.records())
        layers, layer_outcomes = self._layers(city)
        result = CityWards(
            city=city.city,
            state=city.state,
            generated_at=datetime.now(UTC),
            records=valid,
            layers=layers,
            sources=(*outcomes, *layer_outcomes),
            attribution=self._finder.attribution(),
            rejected=rejected,
            note=city.note,
        )
        self._store.save(result)
        return result

    def _validate(
        self, records: tuple[WardRecord, ...]
    ) -> tuple[tuple[WardRecord, ...], tuple[str, ...]]:
        valid: list[WardRecord] = []
        rejected: list[str] = []
        for record in records:
            try:
                self._validator.check(record)
            except InvalidRecordError as error:
                rejected.append(f"{record.key.id}: {error}")
                continue
            valid.append(record)
        return tuple(valid), tuple(rejected)

    def _layers(
        self, city: CitySources
    ) -> tuple[tuple[FeatureLayer, ...], tuple[SourceOutcome, ...]]:
        layers: list[FeatureLayer] = []
        outcomes: list[SourceOutcome] = []
        for kind in self._finder.kinds():
            try:
                layer = self._finder.find(kind, city.bbox)
            except FetchError as error:
                source = self._finder.describe(kind)
                outcomes.append(SourceOutcome(source, "unreachable", str(error)))
                continue
            layers.append(layer)
            detail = f"{len(layer.features)} feature(s) in the city box"
            outcomes.append(SourceOutcome(self._finder.describe(kind), "fetched", detail))
        return tuple(layers), tuple(outcomes)
