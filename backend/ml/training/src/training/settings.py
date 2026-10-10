"""Typed settings read once from the environment."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from training.domain import ConfigError

CLASS_MAP = Path("data/datasets/class_map.json")


@dataclass(frozen=True)
class Settings:
    cache: Path | None
    repo: Path
    stack: str
    bucket: str | None
    region: str

    @staticmethod
    def from_env(cwd: Path) -> Settings:
        cache = os.environ.get("JUNKSNAP_DATA_CACHE")
        stage = os.environ.get("JUNKSNAP_STAGE", "dev")
        return Settings(
            cache=Path(cache) if cache else None,
            repo=Path(os.environ.get("JUNKSNAP_REPO") or Settings._find_repo(cwd)),
            stack=f"junksnap-{stage}",
            bucket=os.environ.get("ORIGINALS_BUCKET") or None,
            region=os.environ.get("AWS_REGION", "ap-south-1"),
        )

    @staticmethod
    def _find_repo(cwd: Path) -> Path:
        for folder in (cwd, *cwd.parents):
            if (folder / CLASS_MAP).exists():
                return folder
        raise ConfigError(f"no {CLASS_MAP} above {cwd}; set JUNKSNAP_REPO")

    def require_cache(self) -> Path:
        if self.cache is None:
            raise ConfigError("set JUNKSNAP_DATA_CACHE to a folder outside the repo")
        return self.outside_repo(self.cache)

    def outside_repo(self, path: Path) -> Path:
        """Image folders must sit outside the repo so images can never be committed."""
        if path.resolve().is_relative_to(self.repo.resolve()):
            raise ConfigError(f"{path} is inside the repo; use a folder outside it")
        return path

    @property
    def datasets_dir(self) -> Path:
        return self.repo / "data" / "datasets"

    @property
    def class_map_path(self) -> Path:
        return self.repo / CLASS_MAP

