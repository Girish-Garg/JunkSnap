from dataclasses import replace
from pathlib import Path

import pytest
from training.domain import Box, ConfigError, ImageRecord, ManifestRow
from training.fetch import RecordFile
from training.manifest import ManifestFile
from training.split import Splitter
from training.utils import safe_stem
from training.yolo import YoloExporter

ITEM = (Box("Drink can", 0.1, 0.2, 0.3, 0.4),)


def row(source: str, name: str, boxes: bool = False) -> ManifestRow:
    path = f"{source}/images/{name}.jpg"
    return ManifestRow(
        f"{source}/{name}", source, "CC-BY-4.0", f"datasets/{path}", path, "waste_dump",
        has_boxes=boxes,
    )


def taco_cache(cache: Path, rows: list[ManifestRow], write_images: bool = True) -> None:
    records = [ImageRecord(r.id, "taco", str(r.local_path), (), ITEM) for r in rows]
    RecordFile(cache, "taco").write(records)
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
    old = [row("taco", f"p{i}") for i in range(100)]
    new = old + [row("taco", f"q{i}") for i in range(100)]
    before = splits(Splitter().assign(old))
    after = splits(Splitter().assign(new))
    assert all(after[k] == v for k, v in before.items())


def test_public_images_split_about_80_10_10() -> None:
    assigned = Splitter().assign([row("taco", f"img{i}") for i in range(2000)])
    share = sum(r.split == "test" for r in assigned) / len(assigned)
    assert 0.08 < share < 0.12
    assert {r.split for r in assigned} == {"train", "val", "test"}


def test_roboflow_augmented_copies_share_one_split() -> None:
    names = [f"train_{safe_stem(f'glass1166_jpg.rf.{h * 16}.jpg')}" for h in ("a1", "b2", "c3")]
    copies = [row("garbage_od", name) for name in names]
    assert len({r.split for r in Splitter().assign(copies)}) == 1
    original = row("garbage_od", "train_glass1166")
    assert Splitter().split_of(copies[0]) == Splitter().split_of(original)


def test_trainable_rows_exclude_the_test_split(tmp_path: Path, store) -> None:
    rows = Splitter().assign([row("taco", f"p{i}") for i in range(200)])
    ManifestFile(tmp_path, tmp_path, store).write(rows, 26)
    trainable = ManifestFile(tmp_path, tmp_path, store).trainable()
    assert trainable and {r.split for r in trainable} == {"train", "val"}


def test_yolo_export_writes_every_public_split(tmp_path: Path, class_map, store) -> None:
    cache, out = tmp_path / "cache", tmp_path / "yolo"
    rows = Splitter().assign([row("taco", f"p{i}", boxes=True) for i in range(60)])
    taco_cache(cache, rows)
    counts = YoloExporter(cache, class_map, store).export(rows, out)
    assert counts["train"] + counts["val"] + counts["test"] == 60
    assert counts["box:waste_item"] == 60
    assert "test: test.txt" in (out / "data.yaml").read_text().splitlines()
    label = next((out / "labels").rglob("*.txt")).read_text().split()
    assert label == ["4", "0.250000", "0.400000", "0.300000", "0.400000"]


def test_yolo_export_downloads_missing_images_or_fails(tmp_path: Path, class_map, store) -> None:
    cache = tmp_path / "cache"
    rows = [replace(r, split="train") for r in (row("taco", "a", True), row("taco", "b", True))]
    taco_cache(cache, rows, write_images=False)
    store.uploaded["datasets/taco/images/a.jpg"] = b"from-s3"
    with pytest.raises(ConfigError, match="taco/b"):
        YoloExporter(cache, class_map, store).export(rows, tmp_path / "yolo")
    assert (cache / "taco/images/a.jpg").read_bytes() == b"from-s3"


