"""One verification case and its result, shaped as contracts/verification_result."""

from dataclasses import dataclass, field
from datetime import UTC, datetime

from ml.domain.images import BlurredImage
from ml.domain.insights import Insights
from ml.domain.purposes import Purpose
from ml.domain.verification import (
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
    reason: str | None = None  # why a fallback decides; logged, not part of the contract


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
    insights: Insights = field(default_factory=Insights)

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
            "insights": self.insights.to_contract() if self.case.purpose.reports_insights else None,
            "decided_at": self.decided_at.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
