import json
from pathlib import Path

import numpy as np
import pytest
from training.domain import ConfigError, ManifestRow
from training.learn.cascade import Calibration, Cascade
from training.learn.cases import CaseWriter
from training.learn.domain import LinearModel
from training.learn.ports import LinearFitter
from training.learn.report import StackReport
from training.learn.stacker import (
    LogitModel,
    ScoredPhoto,
    ScoreMerge,
    StackerTrainer,
    WeightedMean,
)


class EqualFitter(LinearFitter):
    def fit(self, features: np.ndarray, labels: np.ndarray, name: str) -> LinearModel:
        return LinearModel((name,), (tuple(1.0 for _ in range(features.shape[1])),), (0.0,))


def photo(waste: bool, score: float, judge: float | None = None) -> ScoredPhoto:
    scores = {"rekognition_labels": score, "yolo": score, "embedding_classifier": score}
    if judge is not None:
        scores["vision_judge"] = judge
    return ScoredPhoto("p", waste, scores, 0.002 if judge is not None else 0.0)


def test_scored_photo_reads_the_cli_line_and_skips_fire_photos() -> None:
    raw = {"id": "q/a", "truth": {"waste": True}, "signals": {"yolo": 0.9},
           "judge": {"score": 0.8}, "judge_cost": {"usd": 0.002}}
    read = ScoredPhoto.from_json(raw)
    assert read is not None and read.judged and read.scores["vision_judge"] == 0.8
    assert ScoredPhoto.from_json({"id": "f", "truth": {"waste": None}, "signals": {}}) is None


def test_score_files_of_one_split_merge_by_photo() -> None:
    merge = ScoreMerge()
    merge.add([{"id": "a", "truth": {"waste": True}, "signals": {"yolo": 0.9}}])
    merge.add([{"id": "a", "truth": {"waste": True}, "signals": {}, "judge": {"score": 0.7},
                "judge_cost": {"usd": 0.001}}])
    photo_a = ScoredPhoto.from_json(merge.rows()[0])
    assert photo_a is not None and dict(photo_a.scores) == {"yolo": 0.9, "vision_judge": 0.7}


def test_trainer_fits_base_and_judged_models_on_logits() -> None:
    val = [photo(i % 2 == 0, 0.9 if i % 2 == 0 else 0.1, 0.8) for i in range(40)]
    meta = StackerTrainer(EqualFitter()).fit(val, "meta-test")
    assert meta.base.signals == ("rekognition_labels", "yolo", "embedding_classifier")
    assert meta.judged.signals[-1] == "vision_judge"
    assert meta.base.probability({"yolo": 0.5}) == pytest.approx(0.5)
    assert json.loads(json.dumps(meta.to_json({"photos": 40})))["version"] == "meta-test"


def test_trainer_needs_enough_judged_photos() -> None:
    with pytest.raises(ConfigError):
        StackerTrainer(EqualFitter()).fit([photo(True, 0.9)] * 40, "meta-test")


def test_cascade_calls_the_judge_only_when_unsure() -> None:
    model = LogitModel(("rekognition_labels", "yolo", "embedding_classifier", "vision_judge"),
                       (1.0, 1.0, 1.0, 3.0), 0.0)
    cascade = Cascade(model, model)
    assert not cascade.step(photo(True, 0.95, 0.9)).judged
    unsure = cascade.step(photo(True, 0.55, 0.95))
    assert unsure.judged and unsure.probability > 0.85
    report = cascade.evaluate("m", [photo(True, 0.95, 0.9), photo(False, 0.05, 0.1)])
    assert report.accuracy == 1.0 and report.auto_verified == (1, 1) and report.rejected == (1, 1)
    assert report.judge_rate == 0.0 and report.judge_usd == 0.0


def test_fixed_weights_and_calibration() -> None:
    fixed = WeightedMean({"yolo": 1.0, "vision_judge": 3.0})
    assert fixed.probability({"yolo": 0.2, "vision_judge": 0.6}) == pytest.approx(0.5)
    assert Calibration.ece([0.9, 0.9, 0.1, 0.1], [True, True, False, False]) == pytest.approx(0.1)


def test_stack_report_compares_each_signal_and_both_combiners() -> None:
    val = [photo(i % 2 == 0, 0.9 if i % 2 == 0 else 0.1, 0.8) for i in range(40)]
    report = StackReport(StackerTrainer(EqualFitter()).fit(val, "meta-test"))
    assert "| yolo | 40 | 1.000 | 1.000 | 1.000 |" in report.signals_alone(val)
    assert "meta-learner (meta-test)" in report.table(val)


def test_case_writer_never_writes_the_field_holdout(tmp_path: Path) -> None:
    made = [ManifestRow("qr4change/a", "qr4change", "CC", None, "q/a.jpg", "waste_dump",
                        split="val")]
    writer = CaseWriter(tmp_path, ("qr4change",), fire_photos=0)
    assert writer.write(made, "val", tmp_path / "val.jsonl") == 1
    line = json.loads((tmp_path / "val.jsonl").read_text())
    assert line["truth"] == {"source": "qr4change", "waste": True, "burning": False}
    with pytest.raises(ConfigError):
        writer.write(made, "holdout", tmp_path / "h.jsonl")
