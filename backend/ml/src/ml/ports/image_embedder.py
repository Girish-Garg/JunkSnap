"""Port for an image embedding model."""

from abc import ABC, abstractmethod

from ml.domain.embedding import Embedding
from ml.domain.images import BlurredImage


class ImageEmbedder(ABC):
    @abstractmethod
    def embed(self, image: BlurredImage) -> Embedding:
        """An L2-normalised vector; raises ExternalServiceError when the model fails."""
