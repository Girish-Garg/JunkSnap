from dataclasses import replace
from pathlib import Path

import pytest
from training.domain import Attributes, Box, ConfigError, ImageRecord, ManifestRow
from training.fetch import RecordFile
from training.manifest import ManifestFile
from training.split import Splitter
from training.utils import safe_stem
from training.yolo import YoloExporter

PILE = (Box("waste_pile", 0.1, 0.2, 0.3, 0.4),)


def row(source: str, name: str, boxes: bool = False) -> ManifestRow:
    path = f"{source}/images/{name}.jpg"
    return ManifestRow(
        f"{source}/{name}", source, "CC-BY-4.0", f"datasets/{path}", path, "waste_dump",
        has_boxes=boxes,
    )


def field_cache(cache: Path, rows: list[ManifestRow], write_images: bool = True) -> None:
    attrs = Attributes(report_type="waste_dump", context="roadside")
    records = [ImageRecord(r.id, "field", str(r.local_path), (), PILE, attrs) for r in rows]
    RecordFile(cache, "field").write(records)
    for r in rows if write_images else ():
        (cache / str(r.local_path)).parent.mkdir(parents=True, exist_ok=True)
        (cache / str(r.local_path)).write_bytes(b"jpg")


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
    names = [f"train_{safe_stem(f'glass1166_jpg.rf.{h * 16}.jpg')}" for h in ("a1", "b2", "c3")]
    copies = [row("garbage_od", name) for name in names]
    assert len({r.split for r in Splitter().assign(copies)}) == 1
    original = row("garbage_od", "train_glass1166")
    assert Splitter().split_of(copies[0]) == Splitter().split_of(original)


def test_trainable_rows_exclude_test_and_holdout(tmp_path: Path, store) -> None:
    rows = Splitter().assign([row("field", f"p{i}") for i in range(200)])
    ManifestFile(tmp_path, tmp_path, store).write(rows, 26)
    trainable = ManifestFile(tmp_path, tmp_path, store).trainable()
    assert trainable and {r.split for r in trainable} == {"train", "val"}


def test_yolo_export_never_writes_held_out_field_photos(tmp_path: Path, class_map, store) -> None:
    cache, out = tmp_path / "cache", tmp_path / "yolo"
    rows = Splitter().assign([row("field", f"p{i}", boxes=True) for i in range(60)])
    field_cache(cache, rows)
    counts = YoloExporter(cache, class_map, store).export(rows, out)
    held_out = {r.id.replace("/", "__") for r in rows if r.split == "holdout"}
    written = {p.stem for p in out.rglob("*.jpg")}
    assert held_out and written and not held_out & written
    assert counts["box:waste_pile"] == len(written) == 60 - len(held_out)
    assert not any("holdout" in line for line in (out / "data.yaml").read_text().splitlines())
    label = next((out / "labels").rglob("*.txt")).read_text().split()
    assert label == ["0", "0.250000", "0.400000", "0.300000", "0.400000"]


def test_yolo_export_downloads_missing_images_or_fails(tmp_path: Path, class_map, store) -> None:
    cache = tmp_path / "cache"
    rows = [replace(r, split="train") for r in (row("field", "a", True), row("field", "b", True))]
    field_cache(cache, rows, write_images=False)
    store.uploaded["datasets/field/images/a.jpg"] = b"from-s3"
    with pytest.raises(ConfigError, match="field/b"):
        YoloExporter(cache, class_map, store).export(rows, tmp_path / "yolo")
    assert (cache / "field/images/a.jpg").read_bytes() == b"from-s3"


