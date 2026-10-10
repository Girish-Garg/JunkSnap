from pathlib import Path

from training.domain import Box, ImageRecord, ManifestRow
from training.fetch import RecordFile
from training.yolo import BackgroundRule, YoloExporter


def manifest_row(source: str, name: str, report_type: str | None, boxes: bool) -> ManifestRow:
    path = f"{source}/images/{name}.jpg"
    return ManifestRow(
        f"{source}/{name}", source, "CC-BY-4.0", f"datasets/{path}", path, report_type,
        has_boxes=boxes, split="train",
    )


def cache_with(cache: Path, source: str, records: list[ImageRecord]) -> None:
    RecordFile(cache, source).write(records)
    for record in records:
        (cache / record.path).parent.mkdir(parents=True, exist_ok=True)
        (cache / record.path).write_bytes(b"jpg")


def labels(out: Path, row: ManifestRow) -> list[str]:
    stem = row.id.replace("/", "__")
    return (out / "labels" / "train" / f"{stem}.txt").read_text().splitlines()


def test_litter_boxes_become_waste_items_and_bags_stay_bags(
    tmp_path: Path, class_map, store
) -> None:
    rows = [manifest_row("taco", "a", "waste_dump", True)]
    boxes = (Box("Drink can", 0.1, 0.1, 0.2, 0.2), Box("Garbage bag", 0.5, 0.5, 0.2, 0.2))
    cache_with(tmp_path / "c", "taco", [ImageRecord("taco/a", "taco", rows[0].local_path or "",
                                                    (), boxes)])
    counts = YoloExporter(tmp_path / "c", class_map, store).export(rows, tmp_path / "y")
    assert counts["box:waste_item"] == 1 and counts["box:bag"] == 1
    assert [line.split()[0] for line in labels(tmp_path / "y", rows[0])] == ["4", "1"]


def test_teacher_boxes_add_piles_and_clean_photos_are_background(
    tmp_path: Path, class_map, store
) -> None:
    dump = manifest_row("qr4change", "dump", "waste_dump", False)
    clean = manifest_row("qr4change", "clean", "not_waste", False)
    unboxed = manifest_row("qr4change", "unboxed", "waste_dump", False)
    rows = [dump, clean, unboxed]
    records = [ImageRecord(r.id, "qr4change", r.local_path or "", ("garbage",)) for r in rows]
    cache_with(tmp_path / "c", "qr4change", records)
    extra = {dump.id: (Box("waste_pile", 0.2, 0.3, 0.4, 0.5),)}
    counts = YoloExporter(tmp_path / "c", class_map, store).export(rows, tmp_path / "y", extra)
    assert counts["train"] == 2 and counts["background"] == 1 and counts["box:waste_pile"] == 1
    assert labels(tmp_path / "y", dump)[0].startswith("0 ")
    assert labels(tmp_path / "y", clean) == []
    assert not (tmp_path / "y" / "labels" / "train" / "qr4change__unboxed.txt").exists()


def test_fire_photos_without_fire_are_background() -> None:
    rule = BackgroundRule()
    assert rule.applies(manifest_row("dfire", "x", None, False))
    assert rule.applies(manifest_row("qr4change", "x", "not_waste", False))
    assert not rule.applies(manifest_row("taco", "x", "waste_dump", False))
