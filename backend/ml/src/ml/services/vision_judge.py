"""The vision LLM judge: the last step of detection (decision 0137)."""

import logging
from dataclasses import dataclass

from ml.domain.case import VerificationCase
from ml.domain.errors import NoProviderAnsweredError
from ml.domain.llm import LlmRequest
from ml.domain.verification import JudgeVerdict, SignalResult
from ml.services.judge_answer import JudgeAnswer
from ml.services.provider_router import JsonJob, ProviderRouter

logger = logging.getLogger(__name__)

USER_PROMPT = "Judge this photo. Reply with the JSON object only."


@dataclass(frozen=True)
class JudgeReading:
    verdict: JudgeVerdict
    signal: SignalResult


class VisionJudge:
    NAME = "vision_judge"
    TASK = "judge"
    MAX_TOKENS = 700

    def __init__(self, router: ProviderRouter, system_prompt: str) -> None:
        self._router = router
        self._system_prompt = system_prompt

    def judge(self, case: VerificationCase) -> JudgeReading | None:
        """None (and a warning log) when no provider gave a valid answer."""
        prompt = f"{USER_PROMPT} {case.purpose.judge_hint(case.claim)}".strip()
        request = LlmRequest(
            self._system_prompt, prompt, images=(case.image,), max_tokens=self.MAX_TOKENS
        )
        try:
            answer = self._router.complete_json(JsonJob(self.TASK, request, JudgeAnswer))
        except NoProviderAnsweredError as error:
            logger.warning("judge_unavailable", extra={"fields": {"reason": str(error)}})
            return None
        verdict = answer.value.to_verdict()
        response = answer.response
        signal = SignalResult(
            name=self.NAME,
            score=case.purpose.judge_support(verdict, case.claim),
            provider=response.provider,
            model=response.model,
            version=response.version,
            latency_ms=response.latency_ms,
            notes=(f"{verdict.report_type} {verdict.confidence:.2f}",),
            insights=answer.value.to_insights(),
        )
        return JudgeReading(verdict, signal)
