"""In-memory fakes of the ml package's ports, shared by unit and contract tests."""

import json
from collections.abc import Sequence
from datetime import UTC, datetime

from ml.domain.case import VerificationCase
from ml.domain.errors import ProviderError
from ml.domain.images import BlurredImage
from ml.domain.labels import DetectedLabel, LabelSet
from ml.domain.llm import LlmRequest, LlmResponse, TaskConfig
from ml.domain.pricing import PriceTable
from ml.domain.purposes import Purpose
from ml.domain.verification import CaseFeatures, Claim, SignalResult
from ml.ports.clock import Clock
from ml.ports.image_fitter import ImageFitter
from ml.ports.image_store import BlurredImageStore
from ml.ports.label_detector import LabelDetector
from ml.ports.llm_provider import LlmProvider, ProviderBuilder
from ml.ports.secret_reader import SecretReader
from ml.ports.signal import Signal
from ml.services.provider_factory import ProviderFactory
from ml.services.provider_router import ProviderRouter
from ml.services.vision_judge import VisionJudge

JPEG = b"\xff\xd8\xff\xe0fake-jpeg"
FIXED_NOW = datetime(2026, 10, 10, 2, 15, 3, tzinfo=UTC)
# A structured judge answer (prompt judge_v1): a usable photo of loose waste, claim backed.
JUDGE_FIELDS: dict[str, object] = {
    "garbage": "yes", "bin": "no", "bin_overflowing_or_broken": "no",
    "water_contamination": "no", "construction_debris": "no", "burning": "no",
    "photo_usable": "yes", "context": "vacant_plot", "user_verdict": "yes",
    "user_verdict_confidence": 0.9, "reasoning": "Mixed waste on an open plot.",
    "readable_brands": [],
}
CLEAN_FIELDS: dict[str, object] = {
    **JUDGE_FIELDS, "garbage": "no", "context": None, "user_verdict": "no",
    "reasoning": "A clean street with no waste.",
}


def judge_json(base: dict[str, object] | None = None, **fields: object) -> str:
    """A judge answer: JUDGE_FIELDS (or base) with these fields changed; ... drops a field."""
    body = {**(JUDGE_FIELDS if base is None else base), **fields}
    return json.dumps({key: value for key, value in body.items() if value is not ...})


JUDGE_JSON = judge_json()


class FakeProvider(LlmProvider):
    """Answers from a script: each entry is a text or an exception to raise."""

    def __init__(self, name: str, script: Sequence[str | Exception]) -> None:
        self.name = name
        self.requests: list[LlmRequest] = []
        self._script = list(script)

    def complete(self, request: LlmRequest) -> LlmResponse:
        self.requests.append(request)
        step = self._script.pop(0)
        if isinstance(step, Exception):
            raise step
        return LlmResponse(step, "bedrock", self.name, "4.6", 1200, 1000, 100)


class FakeBuilder(ProviderBuilder):
    def __init__(self, providers: dict[str, LlmProvider | None]) -> None:
        self._providers = providers

    def build(self, model: str) -> LlmProvider | None:
        return self._providers[model]


class FakeSecrets(SecretReader):
    def __init__(self, values: dict[str, str]) -> None:
        self._values = values

    def read(self, secret_id: str) -> str | None:
        return self._values.get(secret_id)


class FakeDetector(LabelDetector):
    def __init__(self, labels: dict[str, float]) -> None:
        self._labels = tuple(DetectedLabel(name, conf) for name, conf in labels.items())

    def detect(self, image: BlurredImage) -> LabelSet:
        return LabelSet(self._labels, "DetectLabels", "3.0", 380)


class FakeSignal(Signal):
    def __init__(self, name: str, score: float) -> None:
        self._name = name
        self._score = score

    def measure(self, case: VerificationCase) -> SignalResult:
        return SignalResult(self._name, self._score, "junksnap", "fake", "1", 10)


class FakeImages(BlurredImageStore):
    def read(self, key: str) -> BlurredImage:
        return BlurredImage(key, JPEG)


class FakeFitter(ImageFitter):
    def __init__(self) -> None:
        self.fitted: list[str] = []

    def fit(self, image: BlurredImage) -> BlurredImage:
        self.fitted.append(image.source)
        return image


class FixedClock(Clock):
    def now(self) -> datetime:
        return FIXED_NOW


def make_case(purpose: str = "report", claim: Claim | None = None) -> VerificationCase:
    prefix = "rpt" if purpose == "report" else "cln"
    return VerificationCase(
        report_id=f"{prefix}_jdh_1",
        purpose=Purpose.named(purpose),
        image=BlurredImage(f"media/reports/{prefix}_jdh_1.jpg", JPEG),
        claim=claim or Claim("waste_dump", "vacant_plot"),
        features=CaseFeatures(6, 0.74, 5),
    )


def provider_error(name: str = "throttled") -> ProviderError:
    return ProviderError(name)


def scripted_judge(*script: str | Exception) -> tuple[VisionJudge, FakeProvider]:
    """The judge on one fake Bedrock model; a ProviderError in the script is an outage."""
    provider = FakeProvider("apac.amazon.nova-lite-v1:0", script)
    factory = ProviderFactory({"bedrock": FakeBuilder({provider.name: provider})})
    router = ProviderRouter({"judge": TaskConfig("bedrock", provider.name)}, factory, PriceTable())
    return VisionJudge(router, "system prompt"), provider
