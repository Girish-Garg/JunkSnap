from abc import ABC, abstractmethod

from ward_crawler.domain.extraction import Extraction, ExtractionRequest, ModelCall


class RecordExtractor(ABC):
    """Reads ward facts out of page text (the LLM)."""

    @abstractmethod
    def extract(self, request: ExtractionRequest) -> Extraction:
        """Raise ExtractionError when no model gives a valid answer."""

    @abstractmethod
    def usage(self) -> tuple[ModelCall, ...]:
        """Every model call made so far, including failed ones."""
