"""What the extractor is asked, what it answers and what each model call cost."""

from collections.abc import Mapping
from dataclasses import dataclass
from types import MappingProxyType

from ward_crawler.domain.sources import MunicipalBody, Source
from ward_crawler.domain.values import FactValue
from ward_crawler.domain.ward import ModelInfo


@dataclass(frozen=True)
class ExtractionRequest:
    city: str
    bodies: tuple[MunicipalBody, ...]
    source: Source
    text: str


@dataclass(frozen=True)
class ExtractedWard:
    """Facts a model read for one ward, with a verbatim snippet that supports them."""

    body: str
    ward_number: int
    evidence: str
    facts: Mapping[str, FactValue]

    def __post_init__(self) -> None:
        object.__setattr__(self, "facts", MappingProxyType(dict(self.facts)))


@dataclass(frozen=True)
class Extraction:
    wards: tuple[ExtractedWard, ...]
    model: ModelInfo


@dataclass(frozen=True)
class ModelCall:
    model: str
    outcome: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
