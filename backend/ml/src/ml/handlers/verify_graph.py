"""Composition root for stacked verification, shared by the web route and the CLI."""

from importlib import resources

import boto3
import httpx
from botocore.config import Config

from agent.adapters.bedrock_converse import BedrockProviderBuilder
from agent.adapters.openai_compatible import OPENAI, OPENROUTER, OpenAiCompatibleBuilder
from agent.adapters.rekognition_labels import RekognitionLabelDetector
from agent.adapters.s3_images import S3BlurredImageStore
from agent.adapters.secrets_manager import SecretsManagerSecretReader
from agent.adapters.system_clock import SystemClock
from agent.domain.pricing import PriceTable
from agent.domain.verification import Thresholds
from agent.ports.llm_provider import ProviderBuilder
from agent.services.combiner import FixedWeightCombiner
from agent.services.label_signal import RekognitionLabelSignal
from agent.services.provider_factory import ProviderFactory
from agent.services.provider_router import ProviderRouter
from agent.services.stacked_verifier import StackedVerifier
from agent.services.vision_judge import VisionJudge
from agent.settings.core import CoreSettings
from agent.settings.llm import LlmSettings

JUDGE_PROMPT = "judge_v0.txt"
# Few retries: a throttled provider should hand over to the next one quickly.
AWS_CONFIG = Config(retries={"max_attempts": 2, "mode": "standard"}, read_timeout=60)
HTTP_TIMEOUT_S = 60.0


class VerifierBuilder:
    """Builds the verifier and its parts once per process."""

    def __init__(self, core: CoreSettings, llm: LlmSettings) -> None:
        self._core = core
        self._llm = llm
        self._session = boto3.session.Session(region_name=core.aws_region)

    def verifier(self) -> StackedVerifier:
        detector = RekognitionLabelDetector(self._session.client("rekognition", config=AWS_CONFIG))
        judge = VisionJudge(self.provider_router(), self._prompt(JUDGE_PROMPT))
        combiner = FixedWeightCombiner(Thresholds())
        return StackedVerifier([RekognitionLabelSignal(detector)], judge, combiner, SystemClock())

    def image_store(self, public_bucket: str) -> S3BlurredImageStore:
        return S3BlurredImageStore(self._session.client("s3", config=AWS_CONFIG), public_bucket)

    def provider_router(self) -> ProviderRouter:
        factory = ProviderFactory(self._provider_builders())
        return ProviderRouter(self._llm.task_configs(), factory, PriceTable())

    def _provider_builders(self) -> dict[str, ProviderBuilder]:
        stage = self._core.stage
        secrets = SecretsManagerSecretReader(
            self._session.client("secretsmanager", config=AWS_CONFIG)
        )
        http = httpx.Client(timeout=HTTP_TIMEOUT_S)
        bedrock = self._session.client("bedrock-runtime", config=AWS_CONFIG)
        return {
            "bedrock": BedrockProviderBuilder(bedrock),
            "openai": OpenAiCompatibleBuilder(
                OPENAI, http, secrets, self._llm.openai_secret(stage)
            ),
            "openrouter": OpenAiCompatibleBuilder(
                OPENROUTER, http, secrets, self._llm.openrouter_secret(stage)
            ),
        }

    @staticmethod
    def _prompt(name: str) -> str:
        return resources.files("agent.prompts").joinpath(name).read_text(encoding="utf-8")
