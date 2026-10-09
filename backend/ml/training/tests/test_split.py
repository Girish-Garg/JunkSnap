from pathlib import Path

from training.domain import Attributes, Box, ImageRecord, ManifestRow
from training.fetch import RecordFile
from training.split import Splitter
from training.yolo import YoloExporter


def row(source: str, name: str) -> ManifestRow:
    path = f"{source}/images/{name}.jpg"
    return ManifestRow(f"{source}/{name}", source, "CC-BY-4.0", None, path, "waste_dump")


def splits(rows: list[ManifestRow]) -> dict[str, str | None]:
    return {r.id: r.split for r in rows}


def test_same_seed_gives_the_same_splits_in_any_order() -> None:
    rows = [row("taco", f"img{i}") for i in range(300)]
    first = splits(Splitter(7).assign(rows))
    again = splits(Splitter(7).assign(list(reversed(rows))))
    assert first == again
    assert first != splits(Splitter(8).assign(rows))


def test_adding_images_never_moves_earlier_ones() -> None:
    old = [row("field", f"p{i}") for i in range(100)]
    new = old + [row("field", f"q{i}") for i in range(100)]
    before = splits(Splitter().assign(old))
    after = splits(Splitter().assign(new))
    assert all(after[k] == v for k, v in before.items())


def test_about_thirty_percent_of_field_photos_are_held_out() -> None:
    assigned = Splitter().assign([row("field", f"p{i}") for i in range(2000)])
    share = sum(r.split == "holdout" for r in assigned) / len(assigned)
    assert 0.27 < share < 0.33
    assert {r.split for r in assigned} == {"holdout", "val", "train"}


def test_public_images_never_get_the_field_holdout() -> None:
    assigned = Splitter().assign([row("taco", f"img{i}") for i in range(500)])
    assert {r.split for r in assigned} == {"train", "val", "test"}


def test_roboflow_augmented_copies_share_one_split() -> None:
    copies = [row("garbage_od", f"train_glass1166_jpg_rf_{h}") for h in ("aa11", "bb22", "cc33")]
    assert len({r.split for r in Splitter().assign(copies)}) == 1


def test_yolo_export_never_writes_held_out_field_photos(tmp_path: Path, class_map) -> None:
    cache, out = tmp_path / "cache", tmp_path / "yolo"
    rows = Splitter().assign([row("field", f"p{i}") for i in range(60)])
    attrs = Attributes(report_type="waste_dump", context="roadside")
    box = (Box("waste_pile", 0.1, 0.2, 0.3, 0.4),)
    records = [ImageRecord(r.id, "field", str(r.local_path), (), box, attrs) for r in rows]
    RecordFile(cache, "field").write(records)
    for r in rows:
        (cache / str(r.local_path)).parent.mkdir(parents=True, exist_ok=True)
        (cache / str(r.local_path)).write_bytes(b"jpg")
    counts = YoloExporter(cache, class_map, out).export(rows)
    held_out = {r.id.replace("/", "__") for r in rows if r.split == "holdout"}
    written = {p.stem for p in out.rglob("*.jpg")}
    assert held_out and not held_out & written
    assert counts["box:waste_pile"] == len(written)
    assert not any("holdout" in line for line in (out / "data.yaml").read_text().splitlines())
    label = next((out / "labels").rglob("*.txt")).read_text().split()
    assert label == ["0", "0.250000", "0.400000", "0.300000", "0.400000"]
