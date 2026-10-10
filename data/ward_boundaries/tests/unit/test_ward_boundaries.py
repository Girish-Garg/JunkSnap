import json
from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path

import pytest
from shapely import Point
from ward_boundaries.adapters.geojson_output import CoverageCleaner, WardChecks, WardFeatures
from ward_boundaries.adapters.neighbour_check import NeighbourCheck
from ward_boundaries.adapters.seat_check import SeatCheck
from ward_boundaries.adapters.shapely_ward_builder import ShapelyWardBuilder, WardShape
from ward_boundaries.domain.models import Document, Place, WardEvidence
from ward_boundaries.domain.privacy import REDACTED, PersonGuard
from ward_boundaries.services.place_matcher import PlaceMatcher
from ward_boundaries.services.ward_texts import GazetteRows, LocalityList, WardCrossCheck

WHEN = datetime(2026, 10, 10, tzinfo=UTC)
LIST = Document(
    "https://news.example/list",
    "intro\nवार्ड 1\nशास्त्री नगर, पावटा (आंशिक), चौपड़।\nवार्ड 2\nमंडोर, कीर्ति नगर\n",
    "a" * 64,
    WHEN,
)
GAZETTE = Document(
    "https://copy.example/gazette", "सीमा 12311\n 01 सरू सागर\n02 मंडोर सीमा 9876\n", "b" * 64, WHEN
)


def place(name: str, lat: float, lon: float, ref: str) -> Place:
    return Place(name, lat, lon, ref)


def ward(number: int, *matched: tuple[str, Place]) -> WardEvidence:
    listed = tuple(dict.fromkeys(name for name, _ in matched))
    return WardEvidence(number, listed, matched, None, (GAZETTE,), (), True)


def test_locality_list_reads_each_ward_and_drops_the_partial_marker() -> None:
    wards = LocalityList().parse(LIST)

    assert wards[1].places == ("शास्त्री नगर", "पावटा", "चौपड़")
    assert wards[2].places == ("मंडोर", "कीर्ति नगर")


def test_gazette_rows_give_numbers_and_populations_in_both_layouts() -> None:
    rows = GazetteRows().parse(GAZETTE)

    assert {n: r.population for n, r in rows.items()} == {1: 12311, 2: 9876}


def test_cross_check_prefers_gazette_numbers_and_notes_what_each_source_gave() -> None:
    combined = WardCrossCheck().combine(GazetteRows().parse(GAZETTE), LocalityList().parse(LIST), 3)

    assert [w.in_gazette for w in combined] == [True, True, False]
    assert combined[0].population == 12311
    assert combined[2].notes == ("ward found in no source",)


def test_matcher_needs_distinctive_names_and_drops_places_two_wards_claim() -> None:
    stations = (
        place("Govt School Kirti Nagar Room 2", 26.33, 73.06, "ps:1"),
        place("Govt Girls School Paota", 26.30, 73.03, "ps:2"),
        place("Girls School", 26.29, 73.02, "ps:3"),
    )
    english = {"कीर्ति नगर": "Kirti Nagar", "पावटा": "Paota", "गर्ल्स स्कूल": "Girls School"}
    wards = (
        WardEvidence(1, ("पावटा", "गर्ल्स स्कूल"), (), None, (GAZETTE,)),
        WardEvidence(2, ("कीर्ति नगर", "पावटा"), (), None, (GAZETTE,)),
    )

    matched = PlaceMatcher((), stations, english).match(wards)

    assert matched[0].matched == ()  # Paota is claimed twice; "Girls School" says nothing
    assert [p.ref for _, p in matched[1].matched] == ["ps:1"]


def test_builder_makes_valid_non_overlapping_wards_and_leaves_out_empty_ones() -> None:
    one = ward(1, ("a", place("a", 26.300, 73.000, "1")), ("b", place("b", 26.302, 73.003, "2")))
    two = ward(2, ("c", place("c", 26.300, 73.010, "3")), ("d", place("d", 26.304, 73.012, "4")))
    three = ward(3)

    shapes, left_out = ShapelyWardBuilder((26.3, 73.0), 600).build((one, two, three))
    report = WardChecks(26.3).report([s.geometry for s in shapes])

    assert [s.evidence.number for s in shapes] == [1, 2]
    assert [number for number, _ in left_out] == [3]
    assert report["invalid"] == 0 and report["overlap_km2"] == 0


def test_features_carry_the_ward_id_rule_offices_and_provenance() -> None:
    one = ward(5, ("a", place("a", 26.300, 73.000, "1")), ("b", place("b", 26.302, 73.003, "2")))
    shapes, _ = ShapelyWardBuilder((26.3, 73.0), 600).build((one,))

    feature = WardFeatures("jodhpur-mc", "Nagar Nigam Jodhpur", 26.3).collection(shapes)[
        "features"
    ][0]

    assert feature["properties"]["id"] == "jodhpur-mc-w5"
    assert feature["properties"]["review_status"] == "unreviewed"
    assert feature["properties"]["source_url"] == GAZETTE.url
    assert feature["properties"]["offices"] == [
        "Ward councillor (parshad), ward 5, Nagar Nigam Jodhpur"
    ]
    assert feature["geometry"]["type"] == "Polygon"


@pytest.mark.parametrize(
    "text",
    [
        "boundary past the house of Shri Example",
        "मोहनलाल जी सांखला का बेरा",
        "गंगाराम जी का बेरा",
        "Ramesh ji ka makan",
        "Mr Example's farm",
        "डॉ. उदाहरण का अस्पताल",
    ],
)
def test_person_references_are_redacted(text: str) -> None:
    assert PersonGuard().clean(text) == REDACTED


@pytest.mark.parametrize(
    "text", ["Hanwant School", "Kirti Nagar", "Uday Mandir Aasan", "Sardar Club"]
)
def test_places_named_after_institutions_stay(text: str) -> None:
    assert PersonGuard().clean(text) == text


def test_stored_notes_never_carry_a_person() -> None:
    one = ward(5, ("a", place("a", 26.300, 73.000, "1")), ("b", place("b", 26.302, 73.003, "2")))
    named = replace(one, notes=("edge runs by Shri Example's house",))
    shapes, _ = ShapelyWardBuilder((26.3, 73.0), 600).build((named,))

    feature = WardFeatures("jodhpur-mc", "Nagar Nigam Jodhpur", 26.3).collection(shapes)[
        "features"
    ][0]

    assert feature["properties"]["notes"] == [REDACTED]
    assert "Example" not in json.dumps(feature, ensure_ascii=False)


def test_seat_check_drops_a_ward_outside_its_official_seat(tmp_path: Path) -> None:
    ring = [[72.99, 26.29], [73.02, 26.29], [73.02, 26.31], [72.99, 26.31], [72.99, 26.29]]
    seats = {
        "features": [
            {
                "properties": {"id": "s20-ac-1"},
                "geometry": {"type": "Polygon", "coordinates": [ring]},
            }
        ]
    }
    (tmp_path / "seats.json").write_text(json.dumps(seats), encoding="utf-8")
    inside = ward(1, ("a", place("a", 26.300, 73.000, "1")), ("b", place("b", 26.302, 73.003, "2")))
    outside = ward(
        2, ("c", place("c", 26.400, 73.200, "3")), ("d", place("d", 26.402, 73.203, "4"))
    )
    shapes, _ = ShapelyWardBuilder((26.3, 73.0), 300).build((inside, outside))

    kept, conflicts = SeatCheck(tmp_path / "seats.json", [[1, 2, "s20-ac-1"]], "https://x").apply(
        shapes
    )

    assert [s.evidence.number for s in kept] == [1]
    assert kept[0].evidence.seat_agrees
    assert conflicts[0][0] == 2


def test_neighbour_check_flags_a_ward_far_from_the_wards_numbered_next_to_it() -> None:
    near = ward(1, ("a", place("a", 26.300, 73.000, "1")), ("b", place("b", 26.302, 73.003, "2")))
    beside = ward(2, ("c", place("c", 26.300, 73.010, "3")), ("d", place("d", 26.304, 73.012, "4")))
    far = ward(3, ("e", place("e", 26.400, 73.200, "5")), ("f", place("f", 26.402, 73.203, "6")))
    shapes, _ = ShapelyWardBuilder((26.3, 73.0), 300).build((near, beside, far))

    checked = {s.evidence.number: s.evidence.layout_agrees for s in NeighbourCheck().apply(shapes)}

    assert checked == {1: True, 2: True, 3: False}


def test_written_wards_never_overlap_and_the_check_reads_the_file(tmp_path: Path) -> None:
    one = WardShape(ward(1), Point(73.0, 26.3).buffer(0.01))
    two = WardShape(ward(2), Point(73.015, 26.3).buffer(0.01))
    cleaned = CoverageCleaner().clean((one, two))
    features = WardFeatures("jodhpur-mc", "Nagar Nigam Jodhpur", 26.3).collection(cleaned)
    path = tmp_path / "wards.geojson"
    path.write_text(json.dumps(features), encoding="utf-8")

    report = WardChecks(26.3).report_file(path)

    assert report["overlap_km2"] == 0
    assert report["invalid"] == 0


def test_each_ward_names_the_models_that_shaped_it() -> None:
    one = ward(5, ("a", place("a", 26.300, 73.000, "1")), ("b", place("b", 26.302, 73.003, "2")))
    shapes, _ = ShapelyWardBuilder((26.3, 73.0), 600).build(
        (replace(one, models=("apac.amazon.nova-pro-v1:0",)),)
    )

    feature = WardFeatures("jodhpur-mc", "Nagar Nigam Jodhpur", 26.3).collection(shapes)[
        "features"
    ][0]

    assert feature["properties"]["models"] == [
        {
            "provider": "bedrock",
            "model": "apac.amazon.nova-pro-v1:0",
            "version": "amazon.nova-pro-v1:0",
        }
    ]
