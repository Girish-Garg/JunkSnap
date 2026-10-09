import io
import json
import shutil
from pathlib import Path

import pytest
from PIL import Image
from training.adapters import HttpDownloader
from training.cli import main
from training.domain import ConfigError, ImageRecord, ManifestRow
from training.fetch import RecordFile
from training.settings import Settings

REPO = Path(__file__).resolve().parents[4]
CDN = "https://d111111abcdef8.cloudfront.net"


def jpeg() -> bytes:
    out = io.BytesIO()
    Image.new("RGB", (640, 480), "grey").save(out, "JPEG")
    return out.getvalue()


def task(image: str) -> dict:
    result = {"from_name": "report_type", "type": "choices", "value": {"choices": ["waste_dump"]}}
    return {"data": {"image": image}, "annotations": [{"result": [result]}]}


@pytest.fixture
def workspace(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> tuple[Path, Path]:
    repo, cache = tmp_path / "repo", tmp_path / "cache"
    (repo / "data" / "datasets").mkdir(parents=True)
    shutil.copy(REPO / "data/datasets/class_map.json", repo / "data/datasets/class_map.json")
    monkeypatch.setenv("JUNKSNAP_REPO", str(repo))
    monkeypatch.setenv("JUNKSNAP_DATA_CACHE", str(cache))
    rows = [ManifestRow(f"taco/i{i}", "taco", "CC-BY-4.0", None, f"taco/images/i{i}.jpg",
                        "waste_dump").to_json() for i in range(30)]
    cache.mkdir()
    (cache / "manifest.jsonl").write_text("".join(json.dumps(r) + "\n" for r in rows))
    return repo, cache


def summary(repo: Path) -> dict[str, object]:
    return json.loads((repo / "data/datasets/manifest_summary.json").read_text())


def test_split_keeps_the_recorded_seed_unless_forced(workspace: tuple[Path, Path]) -> None:
    repo, _ = workspace
    assert main(["split", "--no-upload", "--seed", "26"]) == 0
    assert main(["split", "--no-upload", "--seed", "5"]) == 1
    assert summary(repo)["split_seed"] == 26
    assert main(["split", "--no-upload"]) == 0
    assert summary(repo)["split_seed"] == 26
    assert main(["split", "--no-upload", "--seed", "5", "--force"]) == 0
    assert summary(repo)["split_seed"] == 5


def test_yolo_export_refuses_a_folder_inside_the_repo(workspace: tuple[Path, Path]) -> None:
    repo, _ = workspace
    assert main(["yolo-export", "--no-upload", "--out", str(repo / "yolo")]) == 1
    assert not (repo / "yolo").exists()


def test_no_upload_builds_and_imports_from_the_local_cache(
    workspace: tuple[Path, Path], monkeypatch: pytest.MonkeyPatch
) -> None:
    repo, cache = workspace
    for source, labels in (("qr4change", ["garbage"]), ("taco", []), ("garbage_od", ["glass"]),
                           ("dfire", ["none"])):
        record = ImageRecord(f"{source}/a", source, f"{source}/images/a.jpg", tuple(labels))
        RecordFile(cache, source).write([record])
    assert main(["build-manifest", "--no-upload"]) == 0
    assert summary(repo)["images"] == 4
    monkeypatch.setattr(HttpDownloader, "fetch", lambda self, url: jpeg())
    export = repo.parent / "export.json"
    export.write_text(json.dumps([task(f"{CDN}/media/reports/rpt_jdh_9.jpg")]))
    assert main(["import-field", "--no-upload", str(export)]) == 0
    assert summary(repo)["by_source"]["field"] == 1
    assert (cache / "field" / "rpt_jdh_9.jpg").exists()
    tasks = [task(f"{CDN}/media/reports/rpt_jdh_9.jpg"), task("s3://b/media/reports/rpt_jdh_11.jpg")]
    export.write_text(json.dumps(tasks))
    assert main(["import-field", "--no-upload", str(export)]) == 1
    assert not (cache / "field" / "rpt_jdh_11.jpg").exists()


def test_the_cache_must_be_outside_the_repo(tmp_path: Path) -> None:
    settings = Settings(tmp_path / "repo" / "cache", tmp_path / "repo", "junksnap-dev", None, "x")
    with pytest.raises(ConfigError, match="inside the repo"):
        settings.require_cache()
    assert Settings(tmp_path / "c", tmp_path / "repo", "s", None, "x").require_cache()
