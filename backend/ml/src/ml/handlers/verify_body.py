"""The verify request body from contracts/README.md (worker to agent)."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from agent.domain.case import VerifyInput
from agent.domain.verification import CaseFeatures, Claim
from agent.services.judge_answer import ContextName


class FeaturesBody(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    gps_accuracy_m: float = Field(ge=0)
    reputation: float = Field(ge=0, le=1)
    nearby_verified_reports: int = Field(ge=0)


class VerifyBody(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    report_id: str = Field(pattern=r"^(rpt|cln)_[a-z0-9_]{1,40}$")
    purpose: Literal["report", "cleanup"]
    # Only blurred copies under media/ may reach a model.
    blurred_key: str = Field(pattern=r"^media/[a-z]+/(rpt|cln)_[a-z0-9_]{1,40}\.jpg$")
    report_type: Literal["waste_dump", "no_bin", "contaminated_water", "open_construction"]
    context: ContextName
    features: FeaturesBody

    def to_input(self) -> VerifyInput:
        """Raises InvalidClaimError when the type and context are not a contract pair."""
        features = self.features
        return VerifyInput(
            report_id=self.report_id,
            purpose=self.purpose,
            blurred_key=self.blurred_key,
            claim=Claim(self.report_type, self.context),
            features=CaseFeatures(
                features.gps_accuracy_m, features.reputation, features.nearby_verified_reports
            ),
        )
