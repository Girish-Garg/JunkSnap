"""Port for reading blurred photos from the public bucket."""

from abc import ABC, abstractmethod

from agent.domain.images import BlurredImage


class BlurredImageStore(ABC):
    """Reads blurred copies by key. Keys outside `media/` are refused with NotBlurredImageError."""

    @abstractmethod
    def read(self, key: str) -> BlurredImage:
        """The image at `key`. Raises ExternalServiceError when it cannot be read."""
