"""Image embeddings per manifest row, cached in one file per embedder outside the repo."""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np

from training.domain import ManifestRow
from training.learn.ports import ImageEmbedder

LOG = logging.getLogger(__name__)
BATCH = 64
SAVE_EVERY = 20


class EmbeddingTable:
    """`<cache>/embeddings/<embedder>.npz`: ids and float32 vectors, row-aligned."""

    def __init__(self, cache: Path, embedder: str) -> None:
        self._path = cache / "embeddings" / f"{embedder}.npz"

    def read(self) -> dict[str, np.ndarray]:
        if not self._path.exists():
            return {}
        with np.load(self._path) as data:
            return dict(zip(data["ids"].tolist(), data["vectors"], strict=True))

    def write(self, vectors: dict[str, np.ndarray]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        ids = sorted(vectors)
        matrix = np.stack([vectors[i] for i in ids]).astype(np.float32)
        partial = self._path.with_name(f"{self._path.stem}.partial.npz")
        np.savez(partial, ids=np.array(ids), vectors=matrix)
        partial.replace(self._path)


class EmbeddingCache:
    """Embeds rows not yet in the table, saving as it goes so a stopped run resumes."""

    def __init__(self, embedder: ImageEmbedder, table: EmbeddingTable, cache: Path) -> None:
        self._embedder = embedder
        self._table = table
        self._cache = cache

    def fill(self, rows: list[ManifestRow]) -> dict[str, np.ndarray]:
        vectors = self._table.read()
        todo = [r for r in rows if r.id not in vectors]
        for index in range(0, len(todo), BATCH):
            batch = todo[index : index + BATCH]
            paths = [self._cache / str(r.local_path) for r in batch]
            for row, vector in zip(batch, self._embedder.embed(paths), strict=True):
                vectors[row.id] = np.asarray(vector, dtype=np.float32)
            if (index // BATCH) % SAVE_EVERY == SAVE_EVERY - 1:
                self._table.write(vectors)
                LOG.info("%s: %d of %d embedded", self._embedder.model, index + BATCH, len(todo))
        if todo:
            self._table.write(vectors)
        return vectors
