"""Port for reading one secret value, such as a provider API key."""

from abc import ABC, abstractmethod


class SecretReader(ABC):
    @abstractmethod
    def read(self, secret_id: str) -> str | None:
        """None when the secret does not exist."""
