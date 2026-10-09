"""The vision LLM judge: the last step of detection, run only for unsure or split cases."""

import logging
from dataclasses import dataclass

from agent.domain.case import VerificationCase
from agent.domain.errors import NoProviderAnsweredError
from agent.domain.llm import LlmRequest
from agent.domain.verification import JudgeVerdict, SignalResult
from agent.services.judge_answer import JudgeAnswer
from agent.services.provider_router import JsonJob, ProviderRouter

logger = logging.getLogger(__name__)

USER_PROMPT = "Judge this photo. Reply with the JSON object only."


@dataclass(frozen=True)
class JudgeReading:
    """The judge's verdict and its entry in the signal list."""

    verdict: JudgeVerdict
    signal: SignalResult


class VisionJudge:
    """Asks the `judge` task's providers about the blurred photo.

    The prompt (prompts/judge_v0.txt) asks for report type, context, burning, readable
    brands and a rationale, never counts or boxes. Whether to run it is the combiner's call.
    """

    NAME = "vision_judge"
    TASK = "judge"

    def __init__(self, router: ProviderRouter, system_prompt: str) -> None:
        self._router = router
        self._system_prompt = system_prompt

    def judge(self, case: VerificationCase) -> JudgeReading | None:
        """The reading, or None (logged) when no provider gave a valid answer."""
        request = LlmRequest(system=self._system_prompt, prompt=USER_PROMPT, images=(case.image,))
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
        )
        return JudgeReading(verdict, signal)
