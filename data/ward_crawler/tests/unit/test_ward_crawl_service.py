from dataclasses import replace
from types import MappingProxyType

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

MODEL = ModelInfo("bedrock", "global.anthropic.claude-sonnet-4-6", "4.6")
LIST_URL = "https://lsg.rajasthan.gov.in/jodhpur-uttar-wards.html"
SEATS_URL = "https://ceorajasthan.nic.in/jodhpur-seats.html"
WARD_LIST = "Ward 12 | Paota | Zone North | population 9,876 (2011)\nWard 13 | Mandore\n"
SEATS = "Ward 12 falls in 122-Jodhpur assembly constituency, 17-Jodhpur Lok Sabha.\n"


def ward_list_answer(request: ExtractionRequest) -> Extraction | None:
    if request.source.url != LIST_URL:
        return Extraction((), MODEL)
    facts = {"ward_name": "Paota", "population": Population(9876, 2011)}
    paota = ExtractedWard(
        "jodhpur-uttar-mc", 12, "Ward 12 | Paota | Zone North | population 9,876 (2011)", facts
    )
    invented = ExtractedWard(
        "jodhpur-uttar-mc", 14, "Ward 14 | Not on the page", {"ward_name": "Invented"}
    )
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
    city = make_city(Source(LIST_URL, "Uttar ward list", "jodhpur-uttar-mc"))
    service, store = build(FakeRecordExtractor(ward_list_answer), {LIST_URL: WARD_LIST})

    result = service.run(city)

    assert store.saved == [result]
    # The source names its body, so ward 13 is kept under uttar whatever the model said.
    assert [record.key.id for record in result.records] == [
        "jodhpur-uttar-mc-w12",
        "jodhpur-uttar-mc-w13",
    ]
    record = result.records[0].to_json()
    assert record["ward_name"] == {
        "value": "Paota",
        "source_url": LIST_URL,
        "fetched_at": "2026-10-10T10:00:00Z",
        "page_sha256": make_page(LIST_URL, WARD_LIST).sha256,
    }
    assert record["municipal_body"]["value"] == "Nagar Nigam Jodhpur Uttar"
    assert record["population"]["value"] == {"count": 9876, "census_year": 2011}
    assert record["review_status"] == "unreviewed"
    assert record["extracted_by"] == {
        "provider": "bedrock",
        "model": MODEL.model,
        "version": "4.6",
    }


def test_wards_with_invented_evidence_or_unknown_body_are_dropped() -> None:
    city = make_city(Source(LIST_URL, "Uttar ward list", None))
    service, _ = build(FakeRecordExtractor(ward_list_answer), {LIST_URL: WARD_LIST})

    result = service.run(city)

    assert [record.key.number for record in result.records] == [12]
    assert "model proposed 3 ward(s); 1 kept in all" in result.sources[0].detail


def test_facts_from_two_pages_merge_into_one_record() -> None:
    seats = {"assembly_seat": Seat("Jodhpur", "122"), "lok_sabha_seat": Seat("Jodhpur", "17")}
    seat_ward = ExtractedWard("jodhpur-uttar-mc", 12, SEATS.strip(), seats)

    def answer(request: ExtractionRequest) -> Extraction:
        if request.source.url == SEATS_URL:
            return Extraction((seat_ward,), MODEL)
        return ward_list_answer(request) or Extraction((), MODEL)

    city = make_city(
        Source(LIST_URL, "ward list", "jodhpur-uttar-mc"),
        Source(SEATS_URL, "seats", "jodhpur-uttar-mc"),
    )
    service, _ = build(FakeRecordExtractor(answer), {LIST_URL: WARD_LIST, SEATS_URL: SEATS})

    record = service.run(city).records[0].to_json()

    assert record["ward_name"]["source_url"] == LIST_URL
    assert record["assembly_seat"]["value"] == {"name": "Jodhpur", "code": "122"}
    assert record["assembly_seat"]["source_url"] == SEATS_URL


def test_unreachable_sources_and_failed_extractions_are_logged_not_fatal() -> None:
    missing = "https://jodhpurmc.org/down.html"
    city = make_city(
        Source(missing, "down", "jodhpur-uttar-mc"),
        Source(LIST_URL, "ward list", "jodhpur-uttar-mc"),
    )
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

    result = service.run(make_city(Source(LIST_URL, "ward list", "jodhpur-uttar-mc")))

    assert len(extractor.requests) == 5
    assert all(len(request.text) <= 500 for request in extractor.requests)
    assert result.sources[0].detail.startswith("5 of ")


def test_only_the_fields_a_source_declares_are_kept() -> None:
    def answer(_request: ExtractionRequest) -> Extraction:
        facts = {"assembly_seat": Seat("Jodhpur", "122"), "ward_name": "Guessed"}
        return Extraction(
            (ExtractedWard("jodhpur-uttar-mc", 12, "Ward 12 falls in 122-Jodhpur", facts),), MODEL
        )

    source = Source(SEATS_URL, "seats", "jodhpur-uttar-mc", ("assembly_seat",))
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
        return Extraction((ExtractedWard("jodhpur-uttar-mc", 12, "Ward 12 | Paota", facts),), MODEL)

    service, _ = build(FakeRecordExtractor(answer), {LIST_URL: WARD_LIST})

    record = service.run(make_city(Source(LIST_URL, "ward list", "jodhpur-uttar-mc"))).records[0]

    assert set(record.facts) == {"municipal_body", "ward_number", "ward_name"}


def test_a_ward_whose_number_is_not_in_its_snippet_is_dropped() -> None:
    def answer(_request: ExtractionRequest) -> Extraction:
        return Extraction((ExtractedWard("jodhpur-uttar-mc", 13, "Ward 12 | Paota", {}),), MODEL)

    service, _ = build(FakeRecordExtractor(answer), {LIST_URL: WARD_LIST})
    result = service.run(make_city(Source(LIST_URL, "ward list", "jodhpur-uttar-mc")))

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


TWO_ROWS = "12 | Paota | 9876\n13 | Mandore | 5555\n"
ROW_PATTERN = r"(?m)^(?P<ward>\d+) \| (?P<ward_name>\w+) \| (?P<population>\d+)$"


def test_a_two_row_snippet_cannot_give_ward_12_the_next_rows_population() -> None:
    def answer(_request: ExtractionRequest) -> Extraction:
        facts = {"population": Population(5555, None), "ward_name": "Mandore"}
        snippet = "12 | Paota | 9876\n13 | Mandore | 5555"
        return Extraction((ExtractedWard("jodhpur-uttar-mc", 12, snippet, facts),), MODEL)

    service, _ = build(FakeRecordExtractor(answer), {LIST_URL: TWO_ROWS})

    record = service.run(make_city(Source(LIST_URL, "ward list", "jodhpur-uttar-mc"))).records[0]

    assert set(record.facts) == {"municipal_body", "ward_number"}


def test_the_row_pattern_fills_missed_wards_and_corrects_wrong_values() -> None:
    def answer(_request: ExtractionRequest) -> Extraction:
        wrong = ExtractedWard("jodhpur-uttar-mc", 12, "12 | Paota | 9876", {"ward_name": "Paota"})
        return Extraction((wrong,), MODEL)

    source = Source(LIST_URL, "ward list", "jodhpur-uttar-mc", (), ROW_PATTERN)
    service, _ = build(FakeRecordExtractor(answer), {LIST_URL: TWO_ROWS})

    result = service.run(make_city(source))

    by_number = {record.key.number: record for record in result.records}
    assert by_number[13].facts["population"].value == Population(5555, None)
    assert by_number[13].extracted_by.provider == "junksnap"
    assert by_number[12].facts["population"].value == Population(9876, None)
    assert "filled by the row pattern: 13" in result.sources[0].detail


def test_the_row_pattern_overrides_a_model_value_it_disagrees_with() -> None:
    def answer(_request: ExtractionRequest) -> Extraction:
        wrong = ExtractedWard("jodhpur-uttar-mc", 12, "12 Paota renamed", {"ward_name": "Paota"})
        return Extraction((wrong,), MODEL)

    page = TWO_ROWS.replace("Paota", "Pavta") + "Notes: 12 Paota renamed\n"
    source = Source(LIST_URL, "ward list", "jodhpur-uttar-mc", (), ROW_PATTERN)
    service, _ = build(FakeRecordExtractor(answer), {LIST_URL: page})

    result = service.run(make_city(source))

    assert result.records[0].facts["ward_name"].value == "Pavta"
    assert "corrected by the row pattern: 12" in result.sources[0].detail


ZONE_ROWS = "23 िवȨाधर नगर 23 x\n24 िकशनपोल 24 x\n25 श्री नगर 25 x\n"
ZONE_PATTERN = r"(?m)^(?P<ward>\d{1,3}) (?P<zone>\D+?) (?P=ward) "


def test_row_zones_pass_only_through_aliases_and_the_name_guard() -> None:
    source = Source(LIST_URL, "ward list", "jodhpur-uttar-mc", ("zone",), ZONE_PATTERN)
    aliases = MappingProxyType({"िवȨाधर नगर": "विद्याधर नगर"})
    city = replace(make_city(source), aliases=aliases)
    nothing = FakeRecordExtractor(lambda _request: Extraction((), MODEL))
    service, _ = build(nothing, {LIST_URL: ZONE_ROWS})

    zones = {record.key.number: record.facts.get("zone") for record in service.run(city).records}

    assert zones[23] is not None and zones[23].value == "विद्याधर नगर"
    assert zones[24] is None  # garbled and no alias
    assert zones[25] is None  # an honorific names a person
