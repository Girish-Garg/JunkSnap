"""One verification case and its result, shaped as contracts/verification_result."""

from dataclasses import dataclass
from datetime import UTC, datetime

from agent.domain.images import BlurredImage
from agent.domain.purposes import Purpose
from agent.domain.verification import (
    CaseFeatures,
    Claim,
    JudgeVerdict,
    Outcome,
    SignalResult,
    Thresholds,
)


@dataclass(frozen=True)
class VerifyInput:
    """The verify request before the photo is read."""

    report_id: str
    purpose: str
    blurred_key: str
    claim: Claim
    features: CaseFeatures


@dataclass(frozen=True)
class VerificationCase:
    report_id: str
    purpose: Purpose
    image: BlurredImage
    claim: Claim
    features: CaseFeatures


@dataclass(frozen=True)
class CombinerInfo:
    kind: str
    version: str


@dataclass(frozen=True)
class VerificationResult:
    case: VerificationCase
    outcome: Outcome
    thresholds: Thresholds
    signals: tuple[SignalResult, ...]
    judge: JudgeVerdict | None
    combiner: CombinerInfo
    decided_at: datetime
    embedding_key: str | None = None

    def to_contract(self) -> dict[str, object]:
        return {
            "report_id": self.case.report_id,
            "purpose": self.case.purpose.name,
            "probability": round(self.outcome.probability, 4),
            "decision": self.outcome.decision,
            "is_clean": self.outcome.is_clean,
            "thresholds": self.thresholds.to_contract(),
            "signals": [signal.to_contract() for signal in self.signals],
            "features": self.case.features.to_contract(),
            "judge": None if self.judge is None else self.judge.to_contract(),
            "disagreement": self.outcome.disagreement,
            "combiner": {"kind": self.combiner.kind, "version": self.combiner.version},
            "embedding_key": self.embedding_key,
            "decided_at": self.decided_at.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
