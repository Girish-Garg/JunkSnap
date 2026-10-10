from abc import ABC, abstractmethod

from ward_crawler.domain.layers import FeatureLayer
from ward_crawler.domain.sources import BoundingBox, Source


class MapLayerFinder(ABC):
    """Finds city-wide map layers such as disposal points, schools and drains."""

    @abstractmethod
    def kinds(self) -> tuple[str, ...]:
        """Layer names this finder can fetch."""

    @abstractmethod
    def find(self, kind: str, bbox: BoundingBox) -> FeatureLayer:
        """Raise FetchError when the layer cannot be fetched."""

    @abstractmethod
    def describe(self, kind: str) -> Source:
        """The service a layer comes from, for the run's source log."""

    @abstractmethod
    def attribution(self) -> str:
        """The credit line the data's licence requires."""
