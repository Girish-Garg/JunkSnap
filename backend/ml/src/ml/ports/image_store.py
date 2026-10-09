"""Port for reading blurred photos from the public bucket."""

from abc import ABC, abstractmethod

from ml.domain.images import BlurredImage


class BlurredImageStore(ABC):
    @abstractmethod
    def read(self, key: str) -> BlurredImage:
        """Refuses keys outside media/ with NotBlurredImageError."""
