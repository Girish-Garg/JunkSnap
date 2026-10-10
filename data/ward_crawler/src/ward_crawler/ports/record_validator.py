from abc import ABC, abstractmethod

from ward_crawler.domain.ward import WardRecord


class RecordValidator(ABC):
    @abstractmethod
    def check(self, record: WardRecord) -> None:
        """Raise InvalidRecordError when the record breaks the contract."""
