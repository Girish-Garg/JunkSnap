"""SecretReader over AWS Secrets Manager."""

from typing import TYPE_CHECKING

from botocore.exceptions import BotoCoreError, ClientError

from ml.domain.errors import ProviderError
from ml.ports.secret_reader import SecretReader

if TYPE_CHECKING:
    from mypy_boto3_secretsmanager import SecretsManagerClient

MISSING_CODES = frozenset({"ResourceNotFoundException"})


class SecretsManagerSecretReader(SecretReader):
    """Keeps found secrets only, so a secret created later is picked up on the next call."""

    def __init__(self, client: "SecretsManagerClient") -> None:
        self._client = client
        self._cache: dict[str, str] = {}

    def read(self, secret_id: str) -> str | None:
        if secret_id not in self._cache:
            value = self._fetch(secret_id)
            if value is None:
                return None
            self._cache[secret_id] = value
        return self._cache[secret_id]

    def _fetch(self, secret_id: str) -> str | None:
        try:
            return self._client.get_secret_value(SecretId=secret_id).get("SecretString")
        except ClientError as error:
            code = error.response.get("Error", {}).get("Code", "")
            if code in MISSING_CODES:
                return None
            raise ProviderError(f"secret {secret_id} unreadable: {code}") from error
        except BotoCoreError as error:
            raise ProviderError(f"secret {secret_id} unreadable: {type(error).__name__}") from error
