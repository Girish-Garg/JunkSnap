import io
from collections.abc import Callable
from pathlib import Path

import pytest
from PIL import Image
from training.domain import ConfigError, ExternalServiceError, ImageRecord
from training.fetch import Fetcher, RecordFile
from training.images import ImageNormaliser
from training.labelstudio import FieldExportReader
from training.manifest import ManifestBuilder
from training.sources.base import SourceInfo
from training.sources.field import FieldExportSource, FieldPhotos, FieldRecordMerge

LICENCES = {"field": "private"}
CDN = "https://d111111abcdef8.cloudfront.net"
Importer = Callable[..., list[ImageRecord]]


class FakeWeb:
    def __init__(self, pages: dict[str, bytes]) -> None:
        self._pages = pages

    def fetch(self, url: str) -> bytes:
        return self._pages[url]


def jpeg() -> bytes:
    out = io.BytesIO()
    Image.new("RGB", (800, 600), "grey").save(out, "JPEG")
    return out.getvalue()


def task(image: str, report_type: str = "waste_dump") -> dict:
    result = {"from_name": "report_type", "type": "choices", "value": {"choices": [report_type]}}
    return {"data": {"image": image}, "annotations": [{"result": [result]}]}


def s3(name: str) -> str:
    return f"s3://fake-bucket/media/reports/rpt_{name}.jpg"


@pytest.fixture
def run_import(store, class_map) -> Importer:
    def run(cache: Path, tasks: list[dict], mode: str = "strict", web: FakeWeb | None = None):
        labelled = FieldExportReader(class_map.vocabulary).records(tasks)
        record_file = RecordFile(cache, "field")
        record_file.pull(store)
        kept = FieldRecordMerge(mode).kept(record_file.read(), labelled)
        photos = FieldPhotos(store, web or FakeWeb({}))
        info = SourceInfo("field", "private", "export")
        source = FieldExportSource(info, labelled, kept, photos)
        return Fetcher(cache, store, ImageNormaliser()).fetch(source, None)

    return run


def test_blurred_copies_from_s3_and_cloudfront_reach_the_private_bucket(
    tmp_path: Path, store, class_map, run_import: Importer
) -> None:
    store.uploaded["media/reports/rpt_jdh_9.jpg"] = jpeg()
    web = FakeWeb({f"{CDN}/media/reports/rpt_jdh_10.jpg": jpeg()})
    run_import(tmp_path, [task(s3("jdh_9"), "no_bin"), task(f"{CDN}/media/reports/rpt_jdh_10.jpg")],
               web=web)
    rows = {r.id: r for r in ManifestBuilder(tmp_path, class_map, LICENCES).build(store)}
    assert rows["field/rpt_jdh_9"].s3_key == "datasets/field/rpt_jdh_9.jpg"
    assert rows["field/rpt_jdh_9"].report_type == "no_bin"
    assert rows["field/rpt_jdh_10"].licence == "private"
    assert "datasets/field/records.jsonl" in store.uploaded


@pytest.mark.parametrize("image", [
    "s3://junksnap-dev-originals-1/reports/upl_jdh_9.jpg",
    "/data/local-files/?d=field%2FIMG_0042.jpg",
    "/data/upload/1/IMG_1.jpg",
    "s3://fake-bucket/media/cleanups/cln_jdh_3c.jpg",
])
def test_originals_and_local_files_are_refused(tmp_path: Path, run_import: Importer, image) -> None:
    with pytest.raises(ConfigError, match="blurred"):
        run_import(tmp_path, [task(image)])


def test_a_missing_or_corrupt_copy_stops_the_import(tmp_path: Path, store, run_import) -> None:
    with pytest.raises(ConfigError, match="missing"):
        run_import(tmp_path, [task(s3("x"))])
    store.uploaded["media/reports/rpt_x.jpg"] = b"corrupt"
    with pytest.raises(ExternalServiceError, match="rpt_x"):
        run_import(tmp_path, [task(s3("x"))])


def test_a_partial_export_needs_keep_missing_or_replace(tmp_path: Path, store, run_import) -> None:
    for name in ("a", "b"):
        store.uploaded[f"media/reports/rpt_{name}.jpg"] = jpeg()
    run_import(tmp_path / "first", [task(s3("a")), task(s3("b"))])
    only_a = [task(s3("a"), "no_bin")]
    with pytest.raises(ConfigError, match="drops 1 recorded"):
        run_import(tmp_path / "second", only_a)
    kept = run_import(tmp_path / "second", only_a, "keep-missing")
    assert {r.image_id: r.attributes.report_type for r in kept} == {
        "field/rpt_a": "no_bin", "field/rpt_b": "waste_dump"}
    replaced = run_import(tmp_path / "second", only_a, "replace")
    assert [r.image_id for r in replaced] == ["field/rpt_a"]
