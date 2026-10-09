import json
import shutil
from pathlib import Path

import pytest
from training.cli import main
from training.domain import ConfigError, ManifestRow
from training.settings import Settings

REPO = Path(__file__).resolve().parents[4]


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


def test_the_cache_must_be_outside_the_repo(tmp_path: Path) -> None:
    settings = Settings(tmp_path / "repo" / "cache", tmp_path / "repo", "junksnap-dev", None, "x")
    with pytest.raises(ConfigError, match="inside the repo"):
        settings.require_cache()
    assert Settings(tmp_path / "c", tmp_path / "repo", "s", None, "x").require_cache()
