"""Factory for every tuned part of the verify graph, from the Tuning read once at startup."""

from pathlib import Path
from typing import TYPE_CHECKING

from ml.adapters.onnx_yolo import OnnxYoloDetector
from ml.adapters.pillow_fitter import PillowImageFitter
from ml.adapters.rekognition_labels import RekognitionLabelDetector
from ml.domain.label_insights import LabelInsights
from ml.domain.linear import EmbeddingHeads, MetaModel
from ml.domain.purposes import Purposes
from ml.ports.embedding_sink import EmbeddingSink
from ml.ports.image_embedder import ImageEmbedder
from ml.services.attempt_window import AttemptWindow
from ml.services.combiner import FixedWeightCombiner
from ml.services.embedding_signal import EmbeddingSignal
from ml.services.judge_fields import JudgeFieldLimits
from ml.services.label_signal import RekognitionLabelSignal
from ml.services.meta_combiner import MetaLearnerCombiner
from ml.services.provider_router import AttemptPolicy, ProviderRouter
from ml.services.vision_judge import JudgeOptions, VisionJudge
from ml.services.yolo_signal import YoloOptions, YoloSignal
from ml.settings.tuning import Tuning

if TYPE_CHECKING:
    from mypy_boto3_rekognition import RekognitionClient


class TunedParts:
    def __init__(self, tuning: Tuning) -> None:
        self._tuning = tuning

    def fitter(self) -> PillowImageFitter:
        images = self._tuning.images
        return PillowImageFitter(images.max_side_px, images.max_bytes, images.jpeg_qualities)

    def label_signal(self, client: "RekognitionClient") -> RekognitionLabelSignal:
        s = self._tuning.signals
        detector = RekognitionLabelDetector(
            client, s.rekognition_max_labels, s.rekognition_min_confidence
        )
        insights = LabelInsights(hazard_min=s.label_hazard_min)
        return RekognitionLabelSignal(detector, insights, weak_weight=s.label_weak_weight)

    def yolo_options(self) -> YoloOptions:
        s = self._tuning.signals
        return YoloOptions(
            s.yolo_hazard_min, s.yolo_size_box_min, s.yolo_size_small_max,
            s.yolo_size_medium_max, s.yolo_bin_reach, s.yolo_bin_alone_weight,
        )

    def yolo_signal(self, model_path: Path, version: str) -> YoloSignal:
        confidence = self._tuning.signals.yolo_min_confidence
        detector = OnnxYoloDetector(model_path, version, confidence)
        return YoloSignal(detector, self.yolo_options())

    def embedding_signal(
        self, embedder: ImageEmbedder, heads: EmbeddingHeads, sink: EmbeddingSink | None = None
    ) -> EmbeddingSignal:
        return EmbeddingSignal(embedder, heads, sink, self._tuning.signals.embedding_hazard_min)

    def judge_options(self) -> JudgeOptions:
        j = self._tuning.judge
        fields = JudgeFieldLimits(j.hazard_min, j.brands_max)
        return JudgeOptions(j.max_tokens, j.temperature, fields)

    def judge(self, router: ProviderRouter, system_prompt: str) -> VisionJudge:
        return VisionJudge(router, system_prompt, options=self.judge_options())

    def attempts(self, window: AttemptWindow | None) -> AttemptPolicy:
        """None: no time limit (offline scoring)."""
        return AttemptPolicy(self._tuning.judge.invalid_answer_retries, window)

    def fixed_combiner(self) -> FixedWeightCombiner:
        gates = self._tuning.gates
        weights, gap = gates.fixed_weights(), gates.disagreement_gap
        return FixedWeightCombiner(gates.thresholds(), weights, gap)

    def meta_combiner(self, model: MetaModel) -> MetaLearnerCombiner:
        gates = self._tuning.gates
        fallback = self.fixed_combiner()
        return MetaLearnerCombiner(model, gates.thresholds(), gates.disagreement_gap, fallback)

    def purposes(self) -> Purposes:
        return Purposes(self._tuning.gates.veto_limits().rules())
