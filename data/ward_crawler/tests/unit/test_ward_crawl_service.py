from fakes import (
    SCHEMA,
    FakeMapLayerFinder,
    FakePageFetcher,
    FakeRecordExtractor,
    FakeRecordStore,
    make_city,
    make_page,
)

from ward_crawler.adapters.json_schema_validator import JsonSchemaRecordValidator
from ward_crawler.domain.extraction import ExtractedWard, Extraction, ExtractionRequest
from ward_crawler.domain.layers import FeatureLayer, MapFeature
from ward_crawler.domain.sources import Source
from ward_crawler.domain.values import FactValue, Population, Seat
from ward_crawler.domain.ward import ModelInfo
from ward_crawler.services.source_reader import ReadLimits, SourceReader
from ward_crawler.services.ward_crawl_service import WardCrawlService

MODEL = ModelInfo("amazon-bedrock", "global.anthropic.claude-sonnet-4-6", "4.6")
LIST_URL = "https://lsg.rajasthan.gov.in/jodhpur-uttar-wards.html"
SEATS_URL = "https://ceorajasthan.nic.in/jodhpur-seats.html"
WARD_LIST = "Ward 12 | Paota | Zone North | population 9,876 (2011)\nWard 13 | Mandore\n"
SEATS = "Ward 12 falls in 122-Jodhpur assembly constituency, 17-Jodhpur Lok Sabha.\n"


def ward_list_answer(request: ExtractionRequest) -> Extraction | None:
    if request.source.url != LIST_URL:
        return Extraction((), MODEL)
    facts = {"ward_name": "Paota", "population": Population(9876, 2011)}
    paota = ExtractedWard("uttar", 12, "Ward 12 | Paota | Zone North | population 9,876", facts)
    invented = ExtractedWard("uttar", 14, "Ward 14 | Not on the page", {"ward_name": "Invented"})
    wrong_body = ExtractedWard("kota", 13, "Ward 13 | Mandore", {"ward_name": "Mandore"})
    return Extraction((paota, invented, wrong_body), MODEL)


def build(
    extractor: FakeRecordExtractor, pages: dict[str, str], layers: tuple[FeatureLayer, ...] = ()
) -> tuple[WardCrawlService, FakeRecordStore]:
    fetcher = FakePageFetcher({url: make_page(url, text) for url, text in pages.items()})
    store = FakeRecordStore()
    service = WardCrawlService(
        reader=SourceReader(fetcher, extractor, ReadLimits(chunk_chars=500, max_chunks=5)),
        finder=FakeMapLayerFinder(layers),
        validator=JsonSchemaRecordValidator(SCHEMA),
        store=store,
    )
    return service, store


def test_extracted_wards_become_validated_records_with_page_provenance() -> None:
    city = make_city(Source(LIST_URL, "Uttar ward list", "uttar"))
    service, store = build(FakeRecordExtractor(ward_list_answer), {LIST_URL: WARD_LIST})

    result = service.run(city)

    assert store.saved == [result]
    # The source names its body, so ward 13 is kept under uttar whatever the model said.
    assert [record.key.id for record in result.records] == [
        "jodhpur-uttar-012",
        "jodhpur-uttar-013",
    ]
    record = result.records[0].to_json()
    assert record["ward_name"] == {
        "value": "Paota",
        "source_url": LIST_URL,
        "fetched_at": "2026-10-10T10:00:00+00:00",
        "page_sha256": make_page(LIST_URL, WARD_LIST).sha256,
    }
    assert record["municipal_body"]["value"] == "Nagar Nigam Jodhpur Uttar"
    assert record["population"]["value"] == {"count": 9876, "census_year": 2011}
    assert record["review_status"] == "unreviewed"
    assert record["extracted_by"] == {
        "provider": "amazon-bedrock",
        "model": MODEL.model,
        "version": "4.6",
    }


def test_wards_with_invented_evidence_or_unknown_body_are_dropped() -> None:
    city = make_city(Source(LIST_URL, "Uttar ward list", None))
    service, _ = build(FakeRecordExtractor(ward_list_answer), {LIST_URL: WARD_LIST})

    result = service.run(city)

    assert [record.key.number for record in result.records] == [12]
    assert "3 ward(s) proposed, 1 kept" in result.sources[0].detail


def test_facts_from_two_pages_merge_into_one_record() -> None:
    def answer(request: ExtractionRequest) -> Extraction:
        if request.source.url == SEATS_URL:
            seats = {
                "assembly_seat": Seat("Jodhpur", "122"),
                "lok_sabha_seat": Seat("Jodhpur", "17"),
            }
            return Extraction(
                (ExtractedWard("uttar", 12, "Ward 12 falls in 122-Jodhpur", seats),), MODEL
            )
        return ward_list_answer(request) or Extraction((), MODEL)

    city = make_city(Source(LIST_URL, "ward list", "uttar"), Source(SEATS_URL, "seats", "uttar"))
    service, _ = build(FakeRecordExtractor(answer), {LIST_URL: WARD_LIST, SEATS_URL: SEATS})

    record = service.run(city).records[0].to_json()

    assert record["ward_name"]["source_url"] == LIST_URL
    assert record["assembly_seat"]["value"] == {"name": "Jodhpur", "code": "122"}
    assert record["assembly_seat"]["source_url"] == SEATS_URL


def test_unreachable_sources_and_failed_extractions_are_logged_not_fatal() -> None:
    missing = "https://jodhpurmc.org/down.html"
    city = make_city(Source(missing, "down", "uttar"), Source(LIST_URL, "ward list", "uttar"))
    service, _ = build(FakeRecordExtractor(lambda _request: None), {LIST_URL: WARD_LIST})

    result = service.run(city)

    statuses = [(outcome.status, outcome.wards_found) for outcome in result.sources]
    assert statuses == [("unreachable", 0), ("fetched", 0), ("unreachable", 0), ("unreachable", 0)]
    assert "1 chunk(s) got no valid model answer" in result.sources[1].detail
    assert result.records == ()


def test_long_pages_are_split_and_capped() -> None:
    long_page = "".join(f"Ward {number} | Place {number}\n" for number in range(1, 400))
    extractor = FakeRecordExtractor(lambda _request: Extraction((), MODEL))
    service, _ = build(extractor, {LIST_URL: long_page})

    result = service.run(make_city(Source(LIST_URL, "ward list", "uttar")))

    assert len(extractor.requests) == 5
    assert all(len(request.text) <= 500 for request in extractor.requests)
    assert result.sources[0].detail.startswith("5 of ")


def test_only_the_fields_a_source_declares_are_kept() -> None:
    def answer(_request: ExtractionRequest) -> Extraction:
        facts = {"assembly_seat": Seat("Jodhpur", "122"), "ward_name": "Guessed"}
        return Extraction(
            (ExtractedWard("uttar", 12, "Ward 12 falls in 122-Jodhpur", facts),), MODEL
        )

    source = Source(SEATS_URL, "seats", "uttar", ("assembly_seat",))
    service, _ = build(FakeRecordExtractor(answer), {SEATS_URL: SEATS})

    record = service.run(make_city(source)).records[0]

    assert set(record.facts) == {"municipal_body", "ward_number", "assembly_seat"}


def test_facts_the_page_does_not_show_are_dropped() -> None:
    def answer(_request: ExtractionRequest) -> Extraction:
        facts: dict[str, FactValue] = {
            "population": Population(9876, None),  # on the page, but not in this snippet
            "zone": "Zone Invented",
            "assembly_seat": Seat("Jodhpur", "999"),
            "ward_name": "Paota",
        }
        return Extraction((ExtractedWard("uttar", 12, "Ward 12 | Paota", facts),), MODEL)

    service, _ = build(FakeRecordExtractor(answer), {LIST_URL: WARD_LIST})

    record = service.run(make_city(Source(LIST_URL, "ward list", "uttar"))).records[0]

    assert set(record.facts) == {"municipal_body", "ward_number", "ward_name"}


def test_a_ward_whose_number_is_not_in_its_snippet_is_dropped() -> None:
    def answer(_request: ExtractionRequest) -> Extraction:
        return Extraction((ExtractedWard("uttar", 13, "Ward 12 | Paota", {}),), MODEL)

    service, _ = build(FakeRecordExtractor(answer), {LIST_URL: WARD_LIST})
    result = service.run(make_city(Source(LIST_URL, "ward list", "uttar")))

    assert result.records == ()
    assert "dropped as not shown on the page: 13" in result.sources[0].detail


def test_map_layers_are_saved_and_a_failed_layer_is_logged() -> None:
    provenance = make_page("https://overpass.example/api/interpreter?data=x", "{}").provenance()
    school = MapFeature("osm:node/7", ((26.29, 73.02),))
    layers = (FeatureLayer("disposal", provenance, (school,)),)
    service, _ = build(FakeRecordExtractor(lambda _r: None), {}, layers)

    result = service.run(make_city())

    assert [layer.kind for layer in result.layers] == ["disposal"]
    assert [outcome.status for outcome in result.sources] == ["fetched", "unreachable"]
    saved = result.to_json()["map_layers"]
    assert saved[0]["count"] == 1
    assert saved[0]["features"] == [{"ref": "osm:node/7", "coords": [[26.29, 73.02]]}]
