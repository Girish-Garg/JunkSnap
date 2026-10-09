"""Port that fits a blurred image within the models' size limits."""

from abc import ABC, abstractmethod

from ml.domain.images import BlurredImage


class ImageFitter(ABC):
    @abstractmethod
    def fit(self, image: BlurredImage) -> BlurredImage:
        """Same source key; raises InvalidImageError when the bytes are not an image."""
