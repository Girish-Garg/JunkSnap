"""The vision LLM judge: runs on every case after the detectors (decision 20261011-0005).

Its answer is one signal the combiner weighs; for a type the detectors were not trained on
it decides. Its composition and size win over the detectors'. It never sets counts or boxes.
"""

import logging
from dataclasses import dataclass

from ml.domain.case import VerificationCase
from ml.domain.errors import NoProviderAnsweredError
from ml.domain.insights import InsightSource
from ml.domain.llm import LlmRequest
from ml.domain.verification import JudgeVerdict, SignalResult
from ml.services.judge_answer import ANSWER_SCHEMAS, PROMPT_VERSION
from ml.services.judge_fields import DEFAULT_LIMITS, JudgeFieldLimits
from ml.services.provider_router import JsonJob, ProviderRouter

logger = logging.getLogger(__name__)

USER_PROMPT = "Judge this photo. Reply with the JSON object only."


@dataclass(frozen=True)
class JudgeReading:
    verdict: JudgeVerdict
    signal: SignalResult


@dataclass(frozen=True)
class JudgeOptions:
    """ML_JUDGE_MAX_TOKENS, ML_JUDGE_TEMPERATURE, and the limits its answer is read with."""

    max_tokens: int = 700
    temperature: float = 0.0
    fields: JudgeFieldLimits = DEFAULT_LIMITS


DEFAULT_OPTIONS = JudgeOptions()


class VisionJudge:
    NAME = "vision_judge"
    TASK = "judge"

    def __init__(
        self,
        router: ProviderRouter,
        system_prompt: str,
        prompt_version: str = PROMPT_VERSION,
        options: JudgeOptions = DEFAULT_OPTIONS,
    ) -> None:
        self._router = router
        self._system_prompt = system_prompt
        self._prompt_version = prompt_version  # recorded in judge.attributes.prompt
        self._options = options

    def judge(self, case: VerificationCase) -> JudgeReading | None:
        """None (and a warning log) when no provider gave a valid answer."""
        prompt = f"{USER_PROMPT} {case.purpose.judge_hint(case.claim)}".strip()
        options = self._options
        request = LlmRequest(
            self._system_prompt, prompt, images=(case.image,),
            max_tokens=options.max_tokens, temperature=options.temperature,
        )
        job = JsonJob(self.TASK, request, ANSWER_SCHEMAS[case.purpose.name], options.fields)
        try:
            answer = self._router.complete_json(job)
        except NoProviderAnsweredError as error:
            logger.warning("judge_unavailable", extra={"fields": {"reason": str(error)}})
            return None
        verdict = answer.value.to_verdict(self._prompt_version)
        response = answer.response
        source = InsightSource(self.NAME, response.provider, response.model, response.version)
        signal = SignalResult(
            name=self.NAME,
            score=case.purpose.judge_support(verdict, case.claim),
            provider=response.provider,
            model=response.model,
            version=response.version,
            latency_ms=response.latency_ms,
            notes=(f"{verdict.answer_for(case.claim)} {verdict.report_type}",),
            insights=answer.value.to_insights(source),
        )
        return JudgeReading(verdict, signal)
