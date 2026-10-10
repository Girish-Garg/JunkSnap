"""Offline scoring of labelled photos: each signal on its own, and the judge when asked."""

import logging
from collections.abc import Mapping
from dataclasses import dataclass

from ml.domain.case import VerificationCase
from ml.domain.errors import JunkSnapError
from ml.domain.pricing import PriceTable
from ml.domain.purposes import Purpose
from ml.domain.verification import CaseFeatures, Claim
from ml.ports.image_fitter import ImageFitter
from ml.ports.image_store import BlurredImageStore
from ml.ports.signal import Signal
from ml.services.metered_provider import UsageLog
from ml.services.vision_judge import VisionJudge

logger = logging.getLogger(__name__)

# The claim every labelled photo is tested against; truth says whether it holds.
CLAIM = Claim("waste_dump", "roadside")
FEATURES = CaseFeatures(gps_accuracy_m=10.0, reputation=0.5, nearby_verified_reports=0)


@dataclass(frozen=True)
class LabelledPhoto:
    case_id: str
    key: str  # a vouched local key, see LocalBlurredImageStore
    truth: Mapping[str, object]


class CaseScorer:
    def __init__(
        self, images: BlurredImageStore, fitter: ImageFitter, signals: Mapping[str, Signal]
    ) -> None:
        self._images = images
        self._fitter = fitter
        self._signals = dict(signals)

    def score(self, photo: LabelledPhoto, judge: VisionJudge | None) -> dict[str, object]:
        case = self._case(photo)
        row: dict[str, object] = {"id": photo.case_id, "truth": dict(photo.truth)}
        row["signals"], row["latency_ms"], row["errors"] = self._measure(case)
        if judge is not None:
            row["judge"] = self._judged(case, judge)
        return row

    def _case(self, photo: LabelledPhoto) -> VerificationCase:
        image = self._fitter.fit(self._images.read(photo.key))
        return VerificationCase(photo.case_id, Purpose.named("report"), image, CLAIM, FEATURES)

    def _measure(
        self, case: VerificationCase
    ) -> tuple[dict[str, float], dict[str, int], dict[str, str]]:
        scores: dict[str, float] = {}
        latency: dict[str, int] = {}
        errors: dict[str, str] = {}
        for name, signal in self._signals.items():
            try:
                result = signal.measure(case)
            except JunkSnapError as error:
                errors[name] = str(error)
                continue
            scores[name], latency[name] = result.score, result.latency_ms
        return scores, latency, errors

    @staticmethod
    def _judged(case: VerificationCase, judge: VisionJudge) -> dict[str, object] | None:
        reading = judge.judge(case)
        if reading is None:
            return None
        verdict, signal = reading.verdict, reading.signal
        return {
            "model": signal.model, "report_type": verdict.report_type,
            "confidence": verdict.confidence, "burning": verdict.burning,
            "answer": verdict.answer_for(case.claim).value,
            "attributes": verdict.attributes.to_contract(),
            "score": signal.score, "latency_ms": signal.latency_ms,
        }


class UsageCost:
    """Tokens and estimated USD of the responses recorded since the last call."""

    def __init__(self, usage: UsageLog, prices: PriceTable) -> None:
        self._usage = usage
        self._prices = prices
        self._seen = 0

    def take(self) -> dict[str, float]:
        new = self._usage.responses[self._seen :]
        self._seen = len(self._usage.responses)
        costs = [self._prices.estimate_usd(r) or 0.0 for r in new]
        return {
            "input_tokens": sum(r.input_tokens for r in new),
            "output_tokens": sum(r.output_tokens for r in new),
            "usd": round(sum(costs), 6),
        }
