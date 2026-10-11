"""Composition root for stacked verification, shared by the web route and the CLI."""

import logging
from importlib import resources
from pathlib import Path

import boto3
from botocore.config import Config

from ml.adapters.bedrock_converse import BedrockProviderBuilder
from ml.adapters.openai_compatible import OpenAiProviderBuilder
from ml.adapters.pillow_fitter import PillowImageFitter
from ml.adapters.rekognition_labels import RekognitionLabelDetector
from ml.adapters.s3_embedding_sink import S3EmbeddingSink
from ml.adapters.s3_images import S3BlurredImageStore
from ml.adapters.s3_model_store import S3ModelStore
from ml.adapters.secrets_manager import SecretsManagerSecretReader
from ml.adapters.system_clock import SystemClock
from ml.domain.errors import JunkSnapError
from ml.domain.label_insights import LabelInsights
from ml.domain.pricing import PriceTable
from ml.domain.verification import Thresholds
from ml.handlers.judge_timeouts import JudgeTimeouts
from ml.handlers.trained_graph import TrainedModels
from ml.ports.image_store import BlurredImageStore
from ml.ports.llm_provider import ProviderBuilder
from ml.ports.signal import Signal
from ml.services.combiner import FixedWeightCombiner
from ml.services.combiner_base import Combiner
from ml.services.judge_answer import PROMPT_VERSION
from ml.services.label_signal import RekognitionLabelSignal
from ml.services.provider_factory import ProviderFactory
from ml.services.provider_router import ProviderRouter
from ml.services.stacked_verifier import StackedVerifier
from ml.services.verify_service import VerifyService
from ml.services.vision_judge import VisionJudge
from ml.settings.core import CoreSettings
from ml.settings.llm import LlmSettings
from ml.settings.models import ModelSettings

JUDGE_PROMPT = f"{PROMPT_VERSION}.txt"  # the version judge.attributes.prompt records
# Rekognition, S3 and Secrets Manager: one resend at most and short reads, so a hung call
# fails fast; Rekognition's 2 x 4 s fits the detectors' 10 s (judge_timeouts).
AWS_CONFIG = Config(
    retries={"total_max_attempts": 2, "mode": "standard"}, connect_timeout=2.0, read_timeout=4.0
)
# Model files at app start (SigLIP 371 MB, YOLO 38 MB): a 4 s read could break a download.
MODEL_FILES_CONFIG = Config(
    retries={"total_max_attempts": 3, "mode": "standard"}, connect_timeout=5.0, read_timeout=30.0
)

logger = logging.getLogger(__name__)


class VerifierBuilder:
    def __init__(
        self,
        core: CoreSettings,
        llm: LlmSettings,
        models: ModelSettings,
        timeouts: JudgeTimeouts | None = None,
    ) -> None:
        self._core = core
        self._llm = llm
        self._models = models
        self._timeouts = timeouts or JudgeTimeouts()  # every Bedrock model call and OpenAI
        self._session = boto3.session.Session(region_name=core.aws_region)

    def service(self, images: BlurredImageStore) -> VerifyService:
        return VerifyService(images, PillowImageFitter(), self.verifier())

    def verifier(self) -> StackedVerifier:
        detector = RekognitionLabelDetector(self._session.client("rekognition", config=AWS_CONFIG))
        signals: list[Signal] = [RekognitionLabelSignal(detector, LabelInsights())]
        judge = VisionJudge(self.provider_router(), self._prompt(JUDGE_PROMPT))
        combiner: Combiner = FixedWeightCombiner(Thresholds())
        trained = self._trained_parts()
        if trained is not None:
            signals += trained[0]
            combiner = trained[1]
        return StackedVerifier(signals, judge, combiner, SystemClock())

    def _trained_parts(self) -> tuple[list[Signal], Combiner] | None:
        """A missing grant, download or hash keeps the v0 graph serving, logged as an error."""
        trained = self._trained()
        if trained is None:
            return None
        try:
            return trained.signals(self._embedding_sink()), trained.combiner(Thresholds())
        except JunkSnapError as error:
            logger.error("trained_models_failed", extra={"fields": {"reason": str(error)}})
            return None

    def _trained(self) -> TrainedModels | None:
        """Without ORIGINALS_BUCKET (tests, a laptop) only the v0 graph can run; it says so."""
        if not self._models.originals_bucket:
            reason = {"reason": "no ORIGINALS_BUCKET"}
            logger.warning("trained_models_off", extra={"fields": reason})
            return None
        s3 = self._session.client("s3", config=MODEL_FILES_CONFIG)
        store = S3ModelStore(s3, self._models.originals_bucket, Path(self._models.model_dir))
        bedrock = self._session.client("bedrock-runtime", config=self._timeouts.aws_config())
        return TrainedModels(store, self._models.pins(), bedrock)

    def _embedding_sink(self) -> S3EmbeddingSink:
        s3 = self._session.client("s3", config=AWS_CONFIG)
        return S3EmbeddingSink(s3, self._models.originals_bucket)

    def image_store(self, public_bucket: str) -> S3BlurredImageStore:
        return S3BlurredImageStore(self._session.client("s3", config=AWS_CONFIG), public_bucket)

    def provider_router(self) -> ProviderRouter:
        factory = ProviderFactory(self._provider_builders())
        window = self._timeouts.window(SystemClock())
        return ProviderRouter(self._llm.task_configs(), factory, PriceTable(), window)

    def _provider_builders(self) -> dict[str, ProviderBuilder]:
        secrets = SecretsManagerSecretReader(
            self._session.client("secretsmanager", config=AWS_CONFIG)
        )
        openai_secret = self._llm.openai_secret(self._core.stage)
        bedrock = self._session.client("bedrock-runtime", config=self._timeouts.aws_config())
        return {
            "bedrock": BedrockProviderBuilder(bedrock),
            "openai": OpenAiProviderBuilder(self._timeouts.http_client(), secrets, openai_secret),
        }

    @staticmethod
    def _prompt(name: str) -> str:
        return resources.files("ml.prompts").joinpath(name).read_text(encoding="utf-8")
