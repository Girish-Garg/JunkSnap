import json
from pathlib import Path

import pytest

from ml.domain.errors import ConfigError
from ml.domain.model_files import ModelPins, PinnedModel
from ml.domain.verification import Thresholds
from ml.handlers.trained_graph import TrainedModels
from ml.handlers.verify_graph import VerifierBuilder
from ml.ports.model_store import ModelStore
from ml.settings.core import CoreSettings
from ml.settings.llm import LlmSettings
from ml.settings.models import ModelSettings

META = {"version": "meta-t", "base": {"signals": ["yolo"], "weights": [1.0], "bias": 0.0},
        "judged": {"signals": ["yolo"], "weights": [1.0], "bias": 0.0}}
HEADS = {"version": "clf-t", "embedder": "some/other-model", "dim": 1,
         "groups": {"report_type": {"classes": ["waste_dump"], "weights": [[1.0]], "biases": [0]}}}


class FolderStore(ModelStore):
    def __init__(self, folder: Path) -> None:
        self._folder = folder

    def fetch(self, model: PinnedModel) -> Path:
        return self._folder / model.key


def models(tmp_path: Path) -> TrainedModels:
    pins = {}
    for name, content in (("meta", META), ("heads", HEADS)):
        path = tmp_path / "models" / f"{name}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(content))
        pins[name] = {"key": f"models/{name}.json", "sha256": "0" * 64, "size_bytes": 1,
                      "version": "t"}
    return TrainedModels(FolderStore(tmp_path), ModelPins.from_json({"models": pins}), None)  # type: ignore[arg-type]


def test_the_meta_learner_comes_from_its_pinned_file(tmp_path: Path) -> None:
    combiner = models(tmp_path).combiner(Thresholds())
    assert combiner.info().kind == "meta_learner" and combiner.info().version == "meta-t"


def test_heads_for_an_unknown_embedder_stop_the_build(tmp_path: Path) -> None:
    with pytest.raises(ConfigError, match="no embedder adapter"):
        models(tmp_path).signals(sink=None)  # type: ignore[arg-type]


def test_without_a_bucket_the_v0_graph_runs_and_says_so(caplog: pytest.LogCaptureFixture) -> None:
    builder = VerifierBuilder(CoreSettings(), LlmSettings(), ModelSettings())
    verifier = builder.verifier()
    assert "trained_models_off" in caplog.text
    assert verifier is not None
