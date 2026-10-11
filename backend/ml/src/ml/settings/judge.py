"""Vision judge settings: its request, its invalid-answer retries and how its answer is read."""

from pydantic import Field

from ml.settings.base import Probability, TunableSettings


class JudgeSettings(TunableSettings):
    # A judge_v1 answer takes a few hundred tokens.
    max_tokens: int = Field(default=700, ge=1, le=8192, alias="ML_JUDGE_MAX_TOKENS")
    temperature: float = Field(
        default=0.0, ge=0.0, le=1.0, allow_inf_nan=False, alias="ML_JUDGE_TEMPERATURE"
    )
    # An answer that fails validation is asked again this often before the next model.
    invalid_answer_retries: int = Field(
        default=1, ge=0, le=3, alias="ML_JUDGE_INVALID_ANSWER_RETRIES"
    )
    # A hazard the judge names counts only this sure; a burning one sets burning yes.
    hazard_min: Probability = Field(default=0.5, alias="ML_JUDGE_HAZARD_MIN")
    brands_max: int = Field(default=20, ge=0, le=100, alias="ML_JUDGE_BRANDS_MAX")
