"""Reads CRAWL_MODELS, the Bedrock extraction models in the order they are tried."""

from pydantic import BaseModel, ConfigDict, ValidationError

from ward_crawler.adapters.bedrock_record_extractor import DEFAULT_MODELS, ModelChoice
from ward_crawler.domain.errors import SourceListError


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    model_id: str
    version: str
    usd_per_million_in: float
    usd_per_million_out: float


class _Models(BaseModel):
    models: list[_Model]


class ModelList:
    def parse(self, raw: str | None) -> tuple[ModelChoice, ...]:
        """Unset or empty means the extractor's default models."""
        if not raw or not raw.strip():
            return DEFAULT_MODELS
        try:
            parsed = _Models.model_validate_json(f'{{"models": {raw}}}')
        except ValidationError as error:
            raise SourceListError(f"CRAWL_MODELS is not a list of models: {error}") from error
        if not parsed.models:
            raise SourceListError("CRAWL_MODELS lists no model")
        return tuple(
            ModelChoice(m.model_id, m.version, m.usd_per_million_in, m.usd_per_million_out)
            for m in parsed.models
        )
