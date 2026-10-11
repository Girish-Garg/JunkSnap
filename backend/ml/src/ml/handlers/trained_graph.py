"""Builds our trained signals and the meta-learner from pinned model files (A2, issue 50)."""

import json
from collections.abc import Callable
from typing import TYPE_CHECKING, Any

from ml.adapters.onnx_siglip import MODEL_ID as SIGLIP
from ml.adapters.onnx_siglip import OnnxSiglipEmbedder
from ml.adapters.titan_embedder import MODEL_ID as TITAN
from ml.adapters.titan_embedder import TitanImageEmbedder
from ml.domain.errors import ConfigError
from ml.domain.linear import EmbeddingHeads, MetaModel
from ml.domain.model_files import ModelPins
from ml.handlers.tuned_parts import TunedParts
from ml.ports.embedding_sink import EmbeddingSink
from ml.ports.image_embedder import ImageEmbedder
from ml.ports.model_store import ModelStore
from ml.ports.signal import Signal
from ml.services.meta_combiner import MetaLearnerCombiner

if TYPE_CHECKING:
    from mypy_boto3_bedrock_runtime import BedrockRuntimeClient


class TrainedModels:
    """Each pinned file is downloaded and checked as the verify graph is built at app start."""

    def __init__(
        self,
        store: ModelStore,
        pins: ModelPins,
        bedrock: "BedrockRuntimeClient",
        parts: TunedParts,
    ) -> None:
        self._store = store
        self._pins = pins
        self._parts = parts
        self._embedders: dict[str, Callable[[], ImageEmbedder]] = {
            TITAN: lambda: TitanImageEmbedder(bedrock),
            SIGLIP: self._siglip,
        }

    def signals(self, sink: EmbeddingSink) -> list[Signal]:
        heads = EmbeddingHeads.from_json(self._json("heads"))
        if heads.embedder not in self._embedders:
            raise ConfigError(f"no embedder adapter for {heads.embedder}")
        embedder = self._embedders[heads.embedder]()
        yolo = self._pins.get("yolo")
        return [
            self._parts.yolo_signal(self._store.fetch(yolo), yolo.version),
            self._parts.embedding_signal(embedder, heads, sink),
        ]

    def combiner(self) -> MetaLearnerCombiner:
        return self._parts.meta_combiner(MetaModel.from_json(self._json("meta")))

    def _siglip(self) -> ImageEmbedder:
        pin = self._pins.get("embedder")
        return OnnxSiglipEmbedder(self._store.fetch(pin), pin.version)

    def _json(self, name: str) -> Any:
        path = self._store.fetch(self._pins.get(name))
        return json.loads(path.read_text(encoding="utf-8"))
