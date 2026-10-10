import io
import json
from collections.abc import Iterator
from pathlib import Path

import pytest
from PIL import Image
from training import manifest as manifest_module
from training.adapters import LocalOnlyStore
from training.domain import Box, ConfigError, ExternalServiceError, ImageRecord, ManifestRow
from training.fetch import Fetcher
from training.images import ImageNormaliser
from training.manifest import ManifestBuilder, ManifestFile
from training.sources.base import DatasetSource, RawItem, SourceInfo
from training.split import Splitter

LICENCES = {"taco": "CC-BY-4.0"}
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


def fetch(cache: Path, store) -> list[ImageRecord]:
    source = FakeSource(SourceInfo("taco", "CC-BY-4.0", "https://example.org"), None)
    return Fetcher(cache, store, ImageNormaliser(max_side=640)).fetch(source, None)


def test_fetch_normalises_uploads_and_skips_broken_images(tmp_path: Path, store) -> None:
    records = fetch(tmp_path, store)
    assert [r.image_id for r in records] == ["taco/big"]
    with Image.open(tmp_path / "taco/images/big.jpg") as image:
        assert max(image.size) == 640
    assert set(store.uploaded) == {"datasets/taco/images/big.jpg", "datasets/taco/records.jsonl"}


def test_manifest_rows_match_the_schema_and_point_at_s3(tmp_path: Path, store, class_map) -> None:
    fetch(tmp_path, store)
    rows = ManifestBuilder(tmp_path, class_map, LICENCES).build(store)
    assert len(rows) == 1
    raw = rows[0].to_json()
    assert set(raw) == MANIFEST_KEYS
    assert raw["s3_key"] == "datasets/taco/images/big.jpg"
    assert raw["materials"] == ["plastic", "e_waste"] and raw["has_boxes"] is True
    assert ManifestRow.from_json(json.loads(json.dumps(raw))) == rows[0]


def test_a_fresh_machine_builds_the_manifest_from_s3(tmp_path: Path, store, class_map) -> None:
    fetch(tmp_path / "first", store)
    rows = ManifestBuilder(tmp_path / "second", class_map, LICENCES).build(store)
    assert [r.s3_key for r in rows] == ["datasets/taco/images/big.jpg"]


def test_a_missing_public_source_stops_the_build(tmp_path: Path, store, class_map) -> None:
    with pytest.raises(ConfigError, match="taco"):
        ManifestBuilder(tmp_path, class_map, LICENCES).build(store)


def test_a_failed_upload_leaves_cache_and_summary_untouched(
    tmp_path: Path, store, class_map, monkeypatch
) -> None:
    cache = tmp_path / "cache"
    fetch(cache, store)
    rows = Splitter(26).assign(ManifestBuilder(cache, class_map, LICENCES).build(store))
    manifest = ManifestFile(cache, tmp_path, store)
    manifest.write(rows, 26)
    files = (cache / "manifest.jsonl", tmp_path / "manifest_summary.json")
    before = [f.read_text() for f in files]

    def refuse(local: Path, key: str) -> None:
        raise ExternalServiceError("s3 down")

    monkeypatch.setattr(manifest_module, "MAX_REPO_BYTES", 10)
    monkeypatch.setattr(store, "upload_file", refuse)
    with pytest.raises(ExternalServiceError):
        manifest.write(Splitter(5).assign(rows), 5)
    assert [f.read_text() for f in files] == before
    assert not list((tmp_path / "cache").glob("*.pending"))


def test_small_manifests_stay_in_the_repo_with_a_summary(tmp_path: Path, store, class_map) -> None:
    fetch(tmp_path / "cache", store)
    built = ManifestBuilder(tmp_path / "cache", class_map, LICENCES).build(store)
    rows = Splitter(3).assign(built)
    summary = ManifestFile(tmp_path / "cache", tmp_path, store).write(rows, 3)
    assert summary["manifest"] == "data/datasets/manifest.jsonl"
    assert summary["by_source"] == {"taco": 1} and summary["split_seed"] == 3
    assert summary["by_material"] == {"e_waste": 1, "plastic": 1}
    assert (tmp_path / "manifest.jsonl").exists()
    manifest = ManifestFile(tmp_path / "cache", tmp_path, store)
    assert manifest.read() == rows and manifest.recorded_seed() == 3


def test_large_manifests_go_to_s3(tmp_path: Path, store, class_map, monkeypatch) -> None:
    monkeypatch.setattr(manifest_module, "MAX_REPO_BYTES", 10)
    fetch(tmp_path / "cache", store)
    rows = ManifestBuilder(tmp_path / "cache", class_map, LICENCES).build(store)
    summary = ManifestFile(tmp_path / "cache", tmp_path, store).write(rows)
    assert summary["manifest"].endswith("/datasets/manifest.jsonl")
    assert "fake-bucket" not in summary["manifest"]
    assert not (tmp_path / "manifest.jsonl").exists()
    assert ManifestFile(tmp_path / "other", tmp_path, store).read() == rows


def test_a_build_never_quietly_drops_rows_from_the_s3_manifest(
    tmp_path: Path, store, class_map, monkeypatch
) -> None:
    monkeypatch.setattr(manifest_module, "MAX_REPO_BYTES", 10)
    fetch(tmp_path / "cache", store)
    rows = ManifestBuilder(tmp_path / "cache", class_map, LICENCES).build(store)
    extra = ManifestRow("taco/other", "taco", "CC-BY-4.0", None, None, "waste_dump")
    ManifestFile(tmp_path / "other", tmp_path, store).write([*rows, extra])
    with pytest.raises(ConfigError, match="1 ids this build lacks"):
        ManifestFile(tmp_path / "cache", tmp_path, store).write(rows)
    ManifestFile(tmp_path / "cache", tmp_path, store).write(rows, allow_drops=True)
    assert ManifestFile(tmp_path / "fresh", tmp_path, store).read() == rows


def test_large_manifest_needs_s3(tmp_path: Path, store, class_map, monkeypatch) -> None:
    monkeypatch.setattr(manifest_module, "MAX_REPO_BYTES", 10)
    fetch(tmp_path / "cache", store)
    rows = ManifestBuilder(tmp_path / "cache", class_map, LICENCES).build(store)
    with pytest.raises(ConfigError, match="5 MB"):
        ManifestFile(tmp_path / "cache", tmp_path, LocalOnlyStore()).write(rows)
