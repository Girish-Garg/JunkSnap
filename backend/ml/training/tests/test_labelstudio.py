import xml.etree.ElementTree as ET
from typing import Any

import pytest
from training.class_map import ClassMap
from training.domain import ConfigError
from training.labelstudio import FieldExportReader, LabelStudioConfig


def choice(name: str, *values: str) -> dict[str, Any]:
    return {"from_name": name, "type": "choices", "value": {"choices": list(values)}}


def task(image: str, results: list[dict[str, Any]], cancelled: bool = False) -> dict[str, Any]:
    annotation = {"result": results, "was_cancelled": cancelled}
    return {"id": 1, "data": {"image": image}, "annotations": [annotation]}


FAKE_EXPORT = [
    task("s3://junksnap-dev-public/media/reports/rpt_jdh_9.jpg", [
        choice("report_type", "waste_dump"),
        choice("context_waste_dump", "vacant_plot"),
        choice("burning", "yes"),
        choice("materials", "plastic", "construction_debris"),
        choice("hazards", "dead_animal"),
        choice("size_class", "truck"),
        {"from_name": "brands", "type": "textarea",
         "value": {"text": ["Brand A, Brand B\nBrand A"]}},
        {"from_name": "boxes", "type": "rectanglelabels", "original_width": 4000,
         "value": {"x": 10, "y": 20, "width": 50, "height": 40,
                   "rectanglelabels": ["waste_pile"]}},
    ]),
    task("/data/local-files/?d=field%2FIMG_0042.jpg", [
        choice("report_type", "no_bin"), choice("context_no_bin", "no_pickup"),
        choice("burning", "no"),
    ]),
    task("/data/upload/1/skipped.jpg", [choice("report_type", "waste_dump")], cancelled=True),
]


def test_config_has_every_question_and_box_label(class_map: ClassMap) -> None:
    root = ET.fromstring(LabelStudioConfig(class_map.vocabulary).xml())
    names = {node.get("name") for node in root.iter() if node.get("name")}
    expected = {"image", "report_type", "burning", "materials", "hazards", "size_class",
                "brands", "boxes", "context_waste_dump", "context_no_bin"}
    assert expected <= names
    materials = next(n for n in root.iter("Choices") if n.get("name") == "materials")
    assert materials.get("choice") == "multiple"
    assert len(materials) == len(class_map.vocabulary.materials)
    labels = [n.get("value") for n in root.iter("Label")]
    assert labels == ["waste_pile", "bag", "bin", "burning"]


def test_import_reads_a_tiny_export(class_map: ClassMap) -> None:
    first, second = FieldExportReader(class_map.vocabulary).records(FAKE_EXPORT)
    assert first.image_id == "field/rpt_jdh_9" and first.path.startswith("s3://")
    attrs = first.attributes
    assert attrs is not None
    assert (attrs.report_type, attrs.context) == ("waste_dump", "vacant_plot")
    assert attrs.size_class == "truck"
    assert attrs.materials == ("plastic", "construction_debris")
    assert attrs.hazards == ("burning", "dead_animal")
    assert attrs.brands == ("Brand A", "Brand B")
    [box] = first.boxes
    assert box.label == "waste_pile"
    assert (box.x, box.y, box.w, box.h) == pytest.approx((0.1, 0.2, 0.5, 0.4))
    assert second.image_id == "field/img_0042"
    assert second.path == "field/images/img_0042.jpg"
    assert second.attributes is not None and second.attributes.hazards == ()


def test_import_rejects_a_context_from_another_report_type(class_map: ClassMap) -> None:
    results = [choice("report_type", "no_bin"), choice("context_waste_dump", "drain")]
    bad = [task("s3://b/k.jpg", results)]
    with pytest.raises(ConfigError):
        FieldExportReader(class_map.vocabulary).records(bad)


def test_import_rejects_unknown_box_labels(class_map: ClassMap) -> None:
    box = {"type": "rectanglelabels",
           "value": {"x": 1, "y": 1, "width": 5, "height": 5, "rectanglelabels": ["person"]}}
    with pytest.raises(ConfigError):
        FieldExportReader(class_map.vocabulary).records([task("s3://b/k.jpg", [
            choice("report_type", "waste_dump"), box])])
