"""Trained model files the service pins by S3 key and SHA-256 (models.json in settings)."""

import hashlib
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from types import MappingProxyType
from typing import Any

from ml.domain.errors import ConfigError

MODELS_PREFIX = "models/"
CHUNK = 1 << 20


@dataclass(frozen=True)
class PinnedModel:
    name: str
    key: str
    sha256: str
    size_bytes: int
    version: str  # recorded as the signal's model version in every result

    def __post_init__(self) -> None:
        if not self.key.startswith(MODELS_PREFIX):
            raise ConfigError(f"model {self.name} must live under {MODELS_PREFIX}: {self.key}")

    def matches(self, path: Path) -> bool:
        """True when the local file has the pinned size and SHA-256."""
        if not path.is_file() or path.stat().st_size != self.size_bytes:
            return False
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(CHUNK), b""):
                digest.update(chunk)
        return digest.hexdigest() == self.sha256


@dataclass(frozen=True)
class ModelPins:
    models: Mapping[str, PinnedModel]

    def get(self, name: str) -> PinnedModel:
        if name not in self.models:
            raise ConfigError(f"no pinned model named {name!r}")
        return self.models[name]

    @staticmethod
    def from_json(raw: Mapping[str, Any]) -> "ModelPins":
        models = {
            name: PinnedModel(
                name, spec["key"], spec["sha256"], int(spec["size_bytes"]), spec["version"]
            )
            for name, spec in raw["models"].items()
        }
        return ModelPins(MappingProxyType(models))
