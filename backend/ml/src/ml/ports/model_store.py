"""Port for fetching pinned model files to local disk."""

from abc import ABC, abstractmethod
from pathlib import Path

from ml.domain.model_files import PinnedModel


class ModelStore(ABC):
    @abstractmethod
    def fetch(self, model: PinnedModel) -> Path:
        """A local copy whose SHA-256 matches the pin; raises ConfigError when it does not."""
