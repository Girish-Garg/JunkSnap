"""The verify request body from contracts/README.md (worker to ml)."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from ml.domain.case import VerifyInput
from ml.domain.errors import InvalidClaimError
from ml.domain.purposes import Purpose
from ml.domain.verification import CaseFeatures, Claim
from ml.services.judge_answer import ContextName


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
        """Raises InvalidClaimError when the id, key folder or type and context do not fit."""
        purpose = Purpose.named(self.purpose)
        if not self.report_id.startswith(f"{purpose.id_prefix}_"):
            raise InvalidClaimError(f"{purpose.name} needs a {purpose.id_prefix}_ report_id")
        if not self.blurred_key.startswith(purpose.media_folder):
            raise InvalidClaimError(f"{purpose.name} needs a key under {purpose.media_folder}")
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
