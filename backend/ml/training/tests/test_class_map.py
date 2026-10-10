import json
from pathlib import Path

import pytest
from training.class_map import ClassMap, ClassRule, SourceRules
from training.domain import Attributes, Box, ConfigError, ImageRecord

TACO_CATEGORIES = 60


def record(source: str, *labels: str, boxes: tuple[Box, ...] = ()) -> ImageRecord:
    return ImageRecord(f"{source}/x", source, f"{source}/images/x.jpg", labels, boxes)


def test_every_source_class_uses_known_values(class_map: ClassMap) -> None:
    vocab = class_map.vocabulary
    assert vocab.yolo_classes == ("waste_pile", "bag", "bin", "burning", "waste_item")
    assert "e_waste" in vocab.materials and "medical" in vocab.materials
    assert set(vocab.contexts) == set(vocab.report_types) - {"not_waste"}


def test_taco_classes_map_to_materials_hazards_and_detector(class_map: ClassMap) -> None:
    box = Box("Garbage bag", 0.1, 0.1, 0.2, 0.2)
    attrs = class_map.attributes_for(record("taco", "Battery", "Food waste", boxes=(box,)))
    assert attrs.report_type is None
    assert attrs.materials == ("plastic", "organic", "e_waste")
    assert attrs.hazards == ("e_waste",)
    assert class_map.yolo_class("taco", "Garbage bag") == "bag"
    assert class_map.yolo_class("taco", "Drink can") == "waste_item"


def test_vocabulary_matches_the_verification_contract(class_map: ClassMap) -> None:
    schemas = Path(__file__).resolve().parents[4] / "contracts" / "schemas"
    raw = (schemas / "verification_result.schema.json").read_text(encoding="utf-8")
    defs = json.loads(raw)["$defs"]
    vocab = class_map.vocabulary
    assert vocab.size_classes == tuple(defs["size_class"]["enum"]) == ("small", "medium", "large")
    assert vocab.materials == tuple(defs["material"]["enum"])
    assert vocab.hazards == tuple(defs["hazard"]["enum"])


def test_india_dump_photos_map_to_report_types(class_map: ClassMap) -> None:
    assert class_map.attributes_for(record("qr4change", "garbage")).report_type == "waste_dump"
    assert class_map.attributes_for(record("qr4change", "non_garbage")).report_type == "not_waste"


def test_fire_and_smoke_are_the_burning_hazard(class_map: ClassMap) -> None:
    attrs = class_map.attributes_for(record("dfire", boxes=(Box("smoke", 0, 0, 1, 1),)))
    assert attrs.hazards == ("burning",)
    assert attrs.report_type is None
    assert class_map.yolo_class("dfire", "fire") == "burning"
    assert class_map.attributes_for(record("dfire", "none")).hazards == ()


def test_product_photos_give_materials_but_no_report_type(class_map: ClassMap) -> None:
    attrs = class_map.attributes_for(record("garbage_od", "biodegradable", "cardboard"))
    assert attrs == Attributes(materials=("organic", "paper"))
    assert class_map.yolo_class("garbage_od", "glass") == "waste_item"


def test_teacher_boxes_on_india_photos_are_piles_and_bins(class_map: ClassMap) -> None:
    assert class_map.yolo_class("qr4change", "waste_pile") == "waste_pile"
    assert class_map.yolo_class("qr4change", "bin") == "bin"
    assert class_map.yolo_class("qr4change", "garbage") is None
    assert class_map.yolo_class("dfire", "none") is None


def test_unknown_class_or_source_is_an_error(class_map: ClassMap) -> None:
    with pytest.raises(ConfigError):
        class_map.attributes_for(record("taco", "Spaceship"))
    with pytest.raises(ConfigError):
        class_map.attributes_for(record("nowhere", "garbage"))


def test_a_rule_with_an_unknown_material_is_rejected(class_map: ClassMap) -> None:
    bad = SourceRules(ClassRule(), {"thing": ClassRule(materials=("unobtainium",))})
    with pytest.raises(ConfigError):
        ClassMap(class_map.vocabulary, {"bad": bad})


def test_report_type_priority_prefers_waste_over_not_waste(class_map: ClassMap) -> None:
    rules = {"a": ClassRule(report_type="not_waste"), "b": ClassRule(report_type="waste_dump")}
    small = ClassMap(class_map.vocabulary, {"s": SourceRules(ClassRule(), rules)})
    assert small.attributes_for(record("s", "a", "b")).report_type == "waste_dump"


def test_taco_map_covers_all_categories(class_map: ClassMap) -> None:
    classes = {name: class_map.yolo_class("taco", name) for name in TACO_NAMES}
    assert len(classes) == TACO_CATEGORIES
    assert {name for name, c in classes.items() if c != "waste_item"} == {"Garbage bag"}


TACO_NAMES = (
    "Aluminium foil", "Battery", "Aluminium blister pack", "Carded blister pack",
    "Other plastic bottle", "Clear plastic bottle", "Glass bottle", "Plastic bottle cap",
    "Metal bottle cap", "Broken glass", "Food Can", "Aerosol", "Drink can", "Toilet tube",
    "Other carton", "Egg carton", "Drink carton", "Corrugated carton", "Meal carton", "Pizza box",
    "Paper cup", "Disposable plastic cup", "Foam cup", "Glass cup", "Other plastic cup",
    "Food waste", "Glass jar", "Plastic lid", "Metal lid", "Other plastic", "Magazine paper",
    "Tissues", "Wrapping paper", "Normal paper", "Paper bag", "Plastified paper bag",
    "Plastic film", "Six pack rings", "Garbage bag", "Other plastic wrapper",
    "Single-use carrier bag", "Polypropylene bag", "Crisp packet", "Spread tub", "Tupperware",
    "Disposable food container", "Foam food container", "Other plastic container",
    "Plastic glooves", "Plastic utensils", "Pop tab", "Rope & strings", "Scrap metal", "Shoe",
    "Squeezable tube", "Plastic straw", "Paper straw", "Styrofoam piece", "Unlabeled litter",
    "Cigarette",
)
