"""Port for reading one secret value, such as a provider API key."""

from abc import ABC, abstractmethod


class SecretReader(ABC):
    """Reads secrets by id. Never logs or returns anything but the value itself."""

    @abstractmethod
    def read(self, secret_id: str) -> str | None:
        """The secret's text, or None when the secret does not exist."""
