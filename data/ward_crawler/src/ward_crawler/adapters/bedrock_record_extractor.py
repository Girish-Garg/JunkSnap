"""The LLM extractor: Bedrock Converse, JSON-only answers, model fallback in a fixed order."""

from dataclasses import dataclass, replace
from typing import TYPE_CHECKING

from botocore.exceptions import BotoCoreError, ClientError

from ward_crawler.adapters.answer_parser import AnswerParser
from ward_crawler.adapters.extraction_prompt import ExtractionPrompt
from ward_crawler.domain.errors import ExtractionError
from ward_crawler.domain.extraction import ExtractedWard, Extraction, ExtractionRequest, ModelCall
from ward_crawler.domain.ward import ModelInfo
from ward_crawler.ports.record_extractor import RecordExtractor

if TYPE_CHECKING:
    from mypy_boto3_bedrock_runtime import BedrockRuntimeClient
    from mypy_boto3_bedrock_runtime.type_defs import MessageUnionTypeDef

MAX_ANSWER_TOKENS = 8_000
# The account cannot use the model at all, so later pages skip it.
NO_ACCESS = {"AccessDeniedException", "ResourceNotFoundException"}


@dataclass(frozen=True)
class ModelChoice:
    """A Bedrock model or inference profile, its exact version and its on-demand price."""

    model_id: str
    version: str
    usd_per_million_in: float
    usd_per_million_out: float

    def cost(self, tokens_in: int, tokens_out: int) -> float:
        spent = tokens_in * self.usd_per_million_in + tokens_out * self.usd_per_million_out
        return spent / 1_000_000


DEFAULT_MODELS = (
    ModelChoice("global.anthropic.claude-sonnet-4-6", "anthropic.claude-sonnet-4-6", 3.0, 15.0),
    ModelChoice(
        "in.anthropic.claude-haiku-4-5-20251001-v1:0",
        "anthropic.claude-haiku-4-5-20251001-v1:0",
        1.0,
        5.0,
    ),
    ModelChoice("apac.amazon.nova-pro-v1:0", "amazon.nova-pro-v1:0", 0.8, 3.2),
)


class BedrockRecordExtractor(RecordExtractor):
    """Tries each model in order. An invalid answer is retried once, then the next model runs."""

    def __init__(
        self,
        client: "BedrockRuntimeClient",
        models: tuple[ModelChoice, ...],
        prompt: ExtractionPrompt,
        parser: AnswerParser,
    ) -> None:
        self._client = client
        self._models = models
        self._prompt = prompt
        self._parser = parser
        self._calls: list[ModelCall] = []
        self._unavailable: set[str] = set()

    def extract(self, request: ExtractionRequest) -> Extraction:
        problems: list[str] = []
        for model in self._models:
            if model.model_id in self._unavailable:
                continue
            try:
                wards = self._ask_with_retry(model, self._prompt.user(request))
            except ExtractionError as error:
                problems.append(f"{model.model_id}: {error}")
                continue
            return Extraction(wards, ModelInfo("amazon-bedrock", model.model_id, model.version))
        raise ExtractionError("no model gave a valid answer: " + " | ".join(problems))

    def usage(self) -> tuple[ModelCall, ...]:
        return tuple(self._calls)

    def _ask_with_retry(self, model: ModelChoice, question: str) -> tuple[ExtractedWard, ...]:
        messages: list[MessageUnionTypeDef] = [{"role": "user", "content": [{"text": question}]}]
        answer = self._converse(model, messages)
        try:
            return self._parser.parse(answer)
        except ExtractionError as problem:
            self._mark_last_invalid()
            messages.append({"role": "assistant", "content": [{"text": answer or "{}"}]})
            repair = self._prompt.repair(str(problem))
            messages.append({"role": "user", "content": [{"text": repair}]})
        try:
            return self._parser.parse(self._converse(model, messages))
        except ExtractionError:
            self._mark_last_invalid()
            raise

    def _converse(self, model: ModelChoice, messages: "list[MessageUnionTypeDef]") -> str:
        try:
            response = self._client.converse(
                modelId=model.model_id,
                system=[{"text": self._prompt.system()}],
                messages=messages,
                inferenceConfig={"maxTokens": MAX_ANSWER_TOKENS, "temperature": 0},
            )
        except (ClientError, BotoCoreError) as error:
            if isinstance(error, ClientError) and error.response["Error"]["Code"] in NO_ACCESS:
                self._unavailable.add(model.model_id)
            outcome = f"error: {str(error)[:120]}"
            self._calls.append(ModelCall(model.model_id, outcome, 0, 0, 0.0))
            raise ExtractionError(f"Bedrock call failed: {error}") from error
        usage = response["usage"]
        tokens_in, tokens_out = usage["inputTokens"], usage["outputTokens"]
        cost = model.cost(tokens_in, tokens_out)
        outcome = str(response["stopReason"])
        self._calls.append(ModelCall(model.model_id, outcome, tokens_in, tokens_out, cost))
        blocks = response["output"].get("message", {}).get("content", [])
        return "".join(block.get("text", "") for block in blocks)

    def _mark_last_invalid(self) -> None:
        self._calls[-1] = replace(self._calls[-1], outcome="invalid answer")
