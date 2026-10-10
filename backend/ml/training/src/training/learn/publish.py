"""Uploads model files to `models/` in the private bucket and pins them for the ml service."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from training.domain import ConfigError
from training.learn.domain import ModelFile
from training.ports import ObjectStore

MODELS_PREFIX = "models"
CHUNK = 1 << 20


@dataclass(frozen=True)
class Release:
    """One file to publish: `name=path@version` on the command line."""

    name: str
    path: Path
    version: str

    @staticmethod
    def parse(text: str) -> Release:
        name, _, rest = text.partition("=")
        path, _, version = rest.rpartition("@")
        if not (name and path and version):
            raise ConfigError(f"expected name=path@version, got {text!r}")
        return Release(name, Path(path), version)


class ModelPublisher:
    def __init__(self, store: ObjectStore) -> None:
        self._store = store

    def publish(self, releases: list[Release], pins: Path) -> dict[str, Any]:
        """Uploads each file under a key that carries its hash, then rewrites the pins file."""
        if not self._store.is_remote:
            raise ConfigError("models are published to S3 only")
        entries = self._existing(pins)
        for release in releases:
            model = self._upload(release)
            entries[release.name] = {**model.to_json(), "version": release.version}
        content = {"note": "Written by `learn publish`; the ml service downloads and checks these.",
                   "models": dict(sorted(entries.items()))}
        pins.write_text(json.dumps(content, indent=2) + "\n", encoding="utf-8", newline="\n")
        return content

    @staticmethod
    def _existing(pins: Path) -> dict[str, Any]:
        """Pins of models not republished now stay, so a partial publish never drops one."""
        if not pins.exists():
            return {}
        return dict(json.loads(pins.read_text(encoding="utf-8")).get("models", {}))

    def _upload(self, release: Release) -> ModelFile:
        digest = self._sha256(release.path)
        key = f"{MODELS_PREFIX}/{release.name}/{digest[:12]}-{release.path.name}"
        self._store.upload_file(release.path, key)
        return ModelFile(release.name, key, digest, release.path.stat().st_size)

    @staticmethod
    def _sha256(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(CHUNK), b""):
                digest.update(chunk)
        return digest.hexdigest()
