import hashlib
import json
from pathlib import Path

import pytest
from training.domain import ConfigError, ManifestRow
from training.learn.bench import JudgeBench
from training.learn.publish import ModelPublisher, Release
from training.learn.sample import BenchmarkSample


def test_publish_uploads_under_a_hashed_key_and_pins_it(tmp_path: Path, store) -> None:
    weights = tmp_path / "best.onnx"
    weights.write_bytes(b"weights")
    pins = tmp_path / "models.json"
    ModelPublisher(store).publish([Release.parse(f"yolo={weights}@yolo26s-v1")], pins)
    pinned = json.loads(pins.read_text())["models"]["yolo"]
    digest = hashlib.sha256(b"weights").hexdigest()
    assert pinned == {"key": f"models/yolo/{digest[:12]}-best.onnx", "sha256": digest,
                      "size_bytes": 7, "version": "yolo26s-v1"}
    assert store.uploaded[pinned["key"]] == b"weights"


def test_a_partial_publish_keeps_the_other_pins(tmp_path: Path, store) -> None:
    pins = tmp_path / "models.json"
    for name in ("yolo", "meta"):
        path = tmp_path / f"{name}.bin"
        path.write_bytes(name.encode())
        ModelPublisher(store).publish([Release.parse(f"{name}={path}@v1")], pins)
    assert set(json.loads(pins.read_text())["models"]) == {"yolo", "meta"}


def test_release_needs_a_name_path_and_version() -> None:
    with pytest.raises(ConfigError):
        Release.parse("yolo=best.onnx")


def bench_row(
    source: str, waste: bool | None, judge: dict[str, object] | None
) -> dict[str, object]:
    return {"truth": {"source": source, "waste": waste, "burning": source == "dfire"},
            "judge": judge, "judge_cost": {"usd": 0.002 if judge else 0.0}}


def test_bench_counts_unanswered_photos_as_wrong() -> None:
    rows = [
        bench_row("qr4change", True, {"report_type": "waste_dump", "burning": False,
                                      "latency_ms": 2000}),
        bench_row("qr4change", False, None),
        bench_row("qr4change", False, {"report_type": "no_bin", "burning": False,
                                       "latency_ms": 3000}),
        bench_row("dfire", None, {"report_type": "not_waste", "burning": True,
                                  "latency_ms": 4000}),
    ]
    row = JudgeBench().summarise("nova", rows)
    assert (row.answered, row.burning_accuracy) == (3, 1.0)
    assert row.type_accuracy == pytest.approx(2 / 3)
    assert row.usd_per_thousand == pytest.approx(2.0)
    assert "| nova | 4 | 3 |" in row.row()


def test_benchmark_sample_is_capped_evenly_and_skips_unsplit_rows() -> None:
    rows = [ManifestRow(f"s/{i:03d}", "s", "CC", None, None, None, split="train")
            for i in range(10)]
    rows.append(ManifestRow("s/new", "s", "CC", None, None, None))
    picked = BenchmarkSample(5).rows(rows)
    assert [r.id for r in picked] == ["s/000", "s/002", "s/004", "s/006", "s/008"]
