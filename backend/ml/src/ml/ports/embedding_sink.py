"""Port for storing a report's embedding, so the worker's SiteMerger can compare photos."""

from abc import ABC, abstractmethod

from ml.domain.embedding import Embedding


class EmbeddingSink(ABC):
    @abstractmethod
    def store(self, case_id: str, embedding: Embedding) -> str:
        """Returns the key `embeddings/{case_id}.json`; raises ExternalServiceError on failure."""
