from abc import ABC, abstractmethod

from ward_crawler.domain.sources import CitySources


class DistrictSources(ABC):
    """Finds the official source list for a district id such as rajasthan-jodhpur."""

    @abstractmethod
    def find(self, district_id: str) -> CitySources | None:
        """None when the repo has no source file for the district."""
