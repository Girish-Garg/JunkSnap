"""Composition root for stacked verification, shared by the web route and the CLI."""

from importlib import resources

import boto3
import httpx
from botocore.config import Config

from ml.adapters.bedrock_converse import BedrockProviderBuilder
from ml.adapters.openai_compatible import OpenAiProviderBuilder
from ml.adapters.pillow_fitter import PillowImageFitter
from ml.adapters.rekognition_labels import RekognitionLabelDetector
from ml.adapters.s3_images import S3BlurredImageStore
from ml.adapters.secrets_manager import SecretsManagerSecretReader
from ml.adapters.system_clock import SystemClock
from ml.domain.label_insights import LabelInsights
from ml.domain.pricing import PriceTable
from ml.domain.verification import Thresholds
from ml.ports.image_store import BlurredImageStore
from ml.ports.llm_provider import ProviderBuilder
from ml.services.combiner import FixedWeightCombiner
from ml.services.label_signal import RekognitionLabelSignal
from ml.services.provider_factory import ProviderFactory
from ml.services.provider_router import ProviderRouter
from ml.services.stacked_verifier import StackedVerifier
from ml.services.verify_service import VerifyService
from ml.services.vision_judge import VisionJudge
from ml.settings.core import CoreSettings
from ml.settings.llm import LlmSettings

JUDGE_PROMPT = "judge_v0.txt"
# Few retries: a throttled provider should hand over to the next one quickly.
AWS_CONFIG = Config(retries={"max_attempts": 2, "mode": "standard"}, read_timeout=60)
HTTP_TIMEOUT_S = 60.0


class VerifierBuilder:
    def __init__(self, core: CoreSettings, llm: LlmSettings) -> None:
        self._core = core
        self._llm = llm
        self._session = boto3.session.Session(region_name=core.aws_region)

    def service(self, images: BlurredImageStore) -> VerifyService:
        return VerifyService(images, PillowImageFitter(), self.verifier())

    def verifier(self) -> StackedVerifier:
        detector = RekognitionLabelDetector(self._session.client("rekognition", config=AWS_CONFIG))
        signal = RekognitionLabelSignal(detector, LabelInsights())
        judge = VisionJudge(self.provider_router(), self._prompt(JUDGE_PROMPT))
        combiner = FixedWeightCombiner(Thresholds())
        return StackedVerifier([signal], judge, combiner, SystemClock())

    def image_store(self, public_bucket: str) -> S3BlurredImageStore:
        return S3BlurredImageStore(self._session.client("s3", config=AWS_CONFIG), public_bucket)

    def provider_router(self) -> ProviderRouter:
        factory = ProviderFactory(self._provider_builders())
        return ProviderRouter(self._llm.task_configs(), factory, PriceTable())

    def _provider_builders(self) -> dict[str, ProviderBuilder]:
        secrets = SecretsManagerSecretReader(
            self._session.client("secretsmanager", config=AWS_CONFIG)
        )
        openai_secret = self._llm.openai_secret(self._core.stage)
        return {
            "bedrock": BedrockProviderBuilder(
                self._session.client("bedrock-runtime", config=AWS_CONFIG)
            ),
            "openai": OpenAiProviderBuilder(
                httpx.Client(timeout=HTTP_TIMEOUT_S), secrets, openai_secret
            ),
        }

    @staticmethod
    def _prompt(name: str) -> str:
        return resources.files("ml.prompts").joinpath(name).read_text(encoding="utf-8")
