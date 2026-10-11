"""Object graph of the offline scoring CLI: chosen signals from local model files, one judge."""

import json
from collections.abc import Callable
from dataclasses import dataclass
from importlib import resources
from pathlib import Path

import boto3

from ml.adapters.bedrock_converse import BedrockProviderBuilder
from ml.adapters.onnx_siglip import MODEL_ID as SIGLIP
from ml.adapters.onnx_siglip import OnnxSiglipEmbedder
from ml.adapters.pillow_fitter import PillowImageFitter
from ml.adapters.titan_embedder import TitanImageEmbedder
from ml.domain.errors import ConfigError
from ml.domain.linear import EmbeddingHeads
from ml.domain.llm import TaskConfig
from ml.domain.pricing import PriceTable
from ml.handlers.client_configs import ClientConfigs
from ml.handlers.tuned_parts import TunedParts
from ml.ports.image_embedder import ImageEmbedder
from ml.ports.signal import Signal
from ml.services.case_scorer import UsageCost
from ml.services.embedding_signal import EmbeddingSignal
from ml.services.judge_answer import PROMPT_VERSION
from ml.services.label_signal import RekognitionLabelSignal
from ml.services.metered_provider import MeteredBuilder, UsageLog
from ml.services.provider_factory import ProviderFactory
from ml.services.provider_router import ProviderRouter
from ml.services.vision_judge import VisionJudge
from ml.services.yolo_signal import YoloSignal
from ml.settings.tuning import Tuning

JUDGE_PROMPT = f"{PROMPT_VERSION}.txt"  # the version judge.attributes.prompt records


@dataclass(frozen=True)
class ScoreOptions:
    signals: tuple[str, ...]
    yolo: Path | None
    heads: Path | None
    embedder: Path | None  # the SigLIP ONNX file, when the heads were trained on SigLIP


class ScoreGraph:
    """Scores with the same tuning as the ml service, so benchmarks measure what it serves."""

    def __init__(self, options: ScoreOptions, region: str, tuning: Tuning) -> None:
        self._options = options
        self._session = boto3.session.Session(region_name=region)
        self._usage = UsageLog()
        self._parts = TunedParts(tuning)
        self._config = ClientConfigs(tuning.timing).offline()

    def signals(self) -> dict[str, Signal]:
        builders: dict[str, Callable[[], Signal]] = {
            RekognitionLabelSignal.NAME: self._rekognition,
            YoloSignal.NAME: self._yolo,
            EmbeddingSignal.NAME: self._embedding,
        }
        unknown = set(self._options.signals) - set(builders)
        if unknown:
            raise ConfigError(f"unknown signals: {sorted(unknown)}")
        return {name: builders[name]() for name in self._options.signals}

    def fitter(self) -> PillowImageFitter:
        return self._parts.fitter()

    def judge(self, model: str | None) -> VisionJudge | None:
        if model is None:
            return None
        client = self._session.client("bedrock-runtime", config=self._config)
        builder = MeteredBuilder(BedrockProviderBuilder(client), self._usage)
        router = ProviderRouter(
            {"judge": TaskConfig("bedrock", model)},
            ProviderFactory({"bedrock": builder}),
            PriceTable(),
            self._parts.attempts(None),  # offline: no time limit
        )
        prompt = resources.files("ml.prompts").joinpath(JUDGE_PROMPT).read_text(encoding="utf-8")
        return self._parts.judge(router, prompt)

    def cost(self) -> UsageCost:
        return UsageCost(self._usage, PriceTable())

    def _rekognition(self) -> Signal:
        return self._parts.label_signal(self._session.client("rekognition", config=self._config))

    def _yolo(self) -> Signal:
        path = self._required(self._options.yolo, "--yolo")
        return self._parts.yolo_signal(path, path.stem)

    def _embedding(self) -> Signal:
        path = self._required(self._options.heads, "--heads")
        heads = EmbeddingHeads.from_json(json.loads(path.read_text(encoding="utf-8")))
        return self._parts.embedding_signal(self._embedder(heads.embedder), heads)

    def _embedder(self, model: str) -> ImageEmbedder:
        if model == SIGLIP:
            onnx = self._required(self._options.embedder, "--embedder")
            return OnnxSiglipEmbedder(onnx, onnx.stem)
        client = self._session.client("bedrock-runtime", config=self._config)
        return TitanImageEmbedder(client)

    @staticmethod
    def _required(path: Path | None, flag: str) -> Path:
        if path is None:
            raise ConfigError(f"{flag} is needed for this signal")
        return path
