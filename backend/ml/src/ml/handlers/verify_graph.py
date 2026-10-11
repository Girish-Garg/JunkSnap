"""Composition root for stacked verification, shared by the web route and the CLI."""

import logging
from importlib import resources
from pathlib import Path

import boto3

from ml.adapters.bedrock_converse import BedrockProviderBuilder
from ml.adapters.openai_compatible import OpenAiProviderBuilder
from ml.adapters.s3_embedding_sink import S3EmbeddingSink
from ml.adapters.s3_images import S3BlurredImageStore
from ml.adapters.s3_model_store import S3ModelStore
from ml.adapters.secrets_manager import SecretsManagerSecretReader
from ml.adapters.system_clock import SystemClock
from ml.domain.errors import JunkSnapError
from ml.domain.pricing import PriceTable
from ml.handlers.client_configs import ClientConfigs
from ml.handlers.judge_timeouts import JudgeTimeouts
from ml.handlers.trained_graph import TrainedModels
from ml.handlers.tuned_parts import TunedParts
from ml.ports.image_store import BlurredImageStore
from ml.ports.llm_provider import ProviderBuilder
from ml.ports.signal import Signal
from ml.services.combiner_base import Combiner
from ml.services.judge_answer import PROMPT_VERSION
from ml.services.provider_factory import ProviderFactory
from ml.services.provider_router import ProviderRouter
from ml.services.stacked_verifier import StackedVerifier
from ml.services.verify_service import VerifyService
from ml.settings.core import CoreSettings
from ml.settings.llm import LlmSettings
from ml.settings.models import ModelSettings
from ml.settings.tuning import Tuning

JUDGE_PROMPT = f"{PROMPT_VERSION}.txt"  # the version judge.attributes.prompt records

logger = logging.getLogger(__name__)


class VerifierBuilder:
    def __init__(
        self,
        core: CoreSettings,
        llm: LlmSettings,
        models: ModelSettings,
        tuning: Tuning | None = None,  # None: read the environment now
    ) -> None:
        self._core = core
        self._llm = llm
        self._models = models
        tuning = tuning or Tuning.load()
        self._parts = TunedParts(tuning)
        self._configs = ClientConfigs(tuning.timing)
        self._timeouts = JudgeTimeouts.of(tuning.timing)  # every Bedrock model call and OpenAI
        self._session = boto3.session.Session(region_name=core.aws_region)

    def service(self, images: BlurredImageStore) -> VerifyService:
        parts = self._parts
        return VerifyService(images, parts.fitter(), self.verifier(), parts.purposes())

    def verifier(self) -> StackedVerifier:
        rekognition = self._session.client("rekognition", config=self._configs.detectors())
        signals: list[Signal] = [self._parts.label_signal(rekognition)]
        judge = self._parts.judge(self.provider_router(), self._prompt(JUDGE_PROMPT))
        combiner: Combiner = self._parts.fixed_combiner()
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
            return trained.signals(self._embedding_sink()), trained.combiner()
        except JunkSnapError as error:
            logger.error("trained_models_failed", extra={"fields": {"reason": str(error)}})
            return None

    def _trained(self) -> TrainedModels | None:
        """Without ORIGINALS_BUCKET (tests, a laptop) only the v0 graph can run; it says so."""
        if not self._models.originals_bucket:
            reason = {"reason": "no ORIGINALS_BUCKET"}
            logger.warning("trained_models_off", extra={"fields": reason})
            return None
        s3 = self._session.client("s3", config=self._configs.model_files())
        store = S3ModelStore(s3, self._models.originals_bucket, Path(self._models.model_dir))
        bedrock = self._session.client("bedrock-runtime", config=self._timeouts.aws_config())
        return TrainedModels(store, self._models.pins(), bedrock, self._parts)

    def _embedding_sink(self) -> S3EmbeddingSink:
        s3 = self._session.client("s3", config=self._configs.detectors())
        return S3EmbeddingSink(s3, self._models.originals_bucket)

    def image_store(self, public_bucket: str) -> S3BlurredImageStore:
        s3 = self._session.client("s3", config=self._configs.detectors())
        return S3BlurredImageStore(s3, public_bucket)

    def provider_router(self) -> ProviderRouter:
        factory = ProviderFactory(self._provider_builders())
        policy = self._parts.attempts(self._timeouts.window(SystemClock()))
        return ProviderRouter(self._llm.task_configs(), factory, PriceTable(), policy)

    def _provider_builders(self) -> dict[str, ProviderBuilder]:
        secrets = SecretsManagerSecretReader(
            self._session.client("secretsmanager", config=self._configs.detectors())
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
