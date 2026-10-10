from abc import ABC, abstractmethod

from ward_crawler.domain.city import CityWards


class RecordStore(ABC):
    @abstractmethod
    def save(self, result: CityWards) -> str:
        """Write the result and return where it went."""
