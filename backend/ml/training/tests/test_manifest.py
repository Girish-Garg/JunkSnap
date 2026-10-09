import io
import json
from collections.abc import Iterator
from pathlib import Path

from PIL import Image
from training import manifest as manifest_module
from training.class_map import ClassMap
from training.domain import Attributes, Box, ImageRecord, ManifestRow
from training.fetch import Fetcher, RecordFile
from training.images import ImageNormaliser
from training.manifest import ManifestBuilder, ManifestFile
from training.sources.base import DatasetSource, RawItem, SourceInfo
from training.split import Splitter

LICENCES = {"taco": "CC-BY-4.0", "field": "private"}
MANIFEST_KEYS = {
    "id", "source", "licence", "s3_key", "local_path", "report_type", "context",
    "materials", "hazards", "size_class", "brands", "has_boxes", "split",
}


def jpeg(width: int, height: int) -> bytes:
    out = io.BytesIO()
    Image.new("RGB", (width, height), "green").save(out, "JPEG")
    return out.getvalue()


class FakeSource(DatasetSource):
    def download(self, cache: Path, limit: int | None) -> None:
        return None

    def items(self, cache: Path, limit: int | None = None) -> Iterator[RawItem]:
        box = Box("Garbage bag", 0.1, 0.1, 0.5, 0.5)
        yield RawItem("big", lambda: jpeg(3000, 2000), ("Battery",), (box,))
        yield RawItem("broken", lambda: b"not an image")


def fetch(cache: Path, store: object) -> list[ImageRecord]:
    source = FakeSource(SourceInfo("taco", "CC-BY-4.0", "https://example.org"), None)  # type: ignore[arg-type]
    return Fetcher(cache, store, ImageNormaliser(max_side=640)).fetch(source, None)  # type: ignore[arg-type]


def test_fetch_normalises_uploads_and_skips_broken_images(tmp_path: Path, store) -> None:
    records = fetch(tmp_path, store)
    assert [r.image_id for r in records] == ["taco/big"]
    with Image.open(tmp_path / "taco/images/big.jpg") as image:
        assert max(image.size) == 640
    assert set(store.uploaded) == {"datasets/taco/images/big.jpg", "datasets/taco/records.jsonl"}


def test_manifest_rows_match_the_schema_and_point_at_s3(tmp_path: Path, store, class_map) -> None:
    fetch(tmp_path, store)
    rows = ManifestBuilder(tmp_path, class_map, LICENCES).build()
    assert len(rows) == 1
    raw = rows[0].to_json()
    assert set(raw) == MANIFEST_KEYS
    assert raw["s3_key"] == "datasets/taco/images/big.jpg"
    assert raw["materials"] == ["plastic", "e_waste"] and raw["has_boxes"] is True
    assert ManifestRow.from_json(json.loads(json.dumps(raw))) == rows[0]


def test_field_records_on_s3_keep_their_key(tmp_path: Path, class_map: ClassMap) -> None:
    attrs = Attributes(report_type="no_bin", context="no_pickup", size_class="cart")
    key = "s3://bucket/media/reports/rpt_a.jpg"
    record = ImageRecord("field/a", "field", key, attributes=attrs)
    RecordFile(tmp_path, "field").write([record])
    [built] = ManifestBuilder(tmp_path, class_map, LICENCES).build()
    assert (built.s3_key, built.local_path) == ("media/reports/rpt_a.jpg", None)
    assert (built.report_type, built.context, built.size_class) == ("no_bin", "no_pickup", "cart")
    assert built.licence == "private"


def test_small_manifests_stay_in_the_repo_with_a_summary(tmp_path: Path, store, class_map) -> None:
    fetch(tmp_path / "cache", store)
    rows = Splitter(3).assign(ManifestBuilder(tmp_path / "cache", class_map, LICENCES).build())
    summary = ManifestFile(tmp_path / "cache", tmp_path, store).write(rows, 3)
    assert summary["manifest"] == "data/datasets/manifest.jsonl"
    assert summary["by_source"] == {"taco": 1} and summary["split_seed"] == 3
    assert summary["by_material"] == {"e_waste": 1, "plastic": 1}
    assert (tmp_path / "manifest.jsonl").exists()
    assert ManifestFile(tmp_path / "cache", tmp_path, store).read() == rows


def test_large_manifests_go_to_s3(tmp_path: Path, store, class_map, monkeypatch) -> None:
    monkeypatch.setattr(manifest_module, "MAX_REPO_BYTES", 10)
    fetch(tmp_path / "cache", store)
    rows = ManifestBuilder(tmp_path / "cache", class_map, LICENCES).build()
    summary = ManifestFile(tmp_path / "cache", tmp_path, store).write(rows)
    assert summary["manifest"] == "s3://fake-bucket/datasets/manifest.jsonl"
    assert not (tmp_path / "manifest.jsonl").exists()
    assert "datasets/manifest.jsonl" in store.uploaded
