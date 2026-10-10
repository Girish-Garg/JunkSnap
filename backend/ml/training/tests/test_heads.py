from pathlib import Path

import numpy as np
import pytest
from training.domain import ConfigError, ManifestRow
from training.learn.domain import LinearModel
from training.learn.embeddings import EmbeddingCache, EmbeddingTable
from training.learn.heads import HeadCatalogue, HeadTrainer
from training.learn.ports import ImageEmbedder, LinearFitter
from training.learn.selection import HeadSelector


class MeanFitter(LinearFitter):
    """Weights point from the negative mean to the positive mean."""

    def __init__(self, strength: float = 1.0) -> None:
        self.strength = strength

    def fit(self, features: np.ndarray, labels: np.ndarray, name: str) -> LinearModel:
        direction = features[labels].mean(axis=0) - features[~labels].mean(axis=0)
        weights = tuple(float(w) * 10 * self.strength for w in direction)
        return LinearModel((name,), (weights,), (0.0,))


class FakeEmbedder(ImageEmbedder):
    def __init__(self) -> None:
        self.calls = 0

    @property
    def model(self) -> str:
        return "fake"

    def embed(self, images: list[Path]) -> list[tuple[float, ...]]:
        self.calls += len(images)
        return [(1.0, 0.0) if "dump" in p.name else (0.0, 1.0) for p in images]


def rows() -> list[ManifestRow]:
    made = []
    for split in ("train", "val", "test"):
        for i in range(50):
            for kind in ("waste_dump", "not_waste"):
                name = "dump" if kind == "waste_dump" else "clean"
                made.append(ManifestRow(
                    f"qr4change/{split}_{name}_{i}", "qr4change", "CC-BY-4.0", None,
                    f"q/{split}_{name}_{i}.jpg", kind, split=split,
                ))
    return made


def vectors(made: list[ManifestRow]) -> dict[str, np.ndarray]:
    return {r.id: np.array([1.0, -1.0] if "dump" in r.id else [-1.0, 1.0]) for r in made}


def test_report_type_head_learns_and_scores_on_test_only_once() -> None:
    made = rows()
    result = HeadSelector(HeadCatalogue.defaults(("plastic",)), MeanFitter).select(
        made, vectors(made)
    )
    assert set(result.heads.groups) == {"report_type"}
    assert result.test[0].name == "report_type:waste_dump" and result.test[0].f1 == 1.0
    assert result.strength == 1.0
    assert "| report_type:waste_dump | test | 50 |" in result.table()
    saved = result.to_json("fake-embedder", "clf-test")
    assert (saved["embedder"], saved["dim"], saved["version"]) == ("fake-embedder", 2, "clf-test")
    assert saved["groups"]["report_type"]["classes"] == ["waste_dump"]


def test_heads_with_too_few_positives_are_not_trained() -> None:
    made = [r for r in rows() if "dump" not in r.id or r.id.endswith(("_1", "_2"))]
    heads = HeadTrainer(MeanFitter(), HeadCatalogue.defaults(())).train(made, vectors(made))
    assert heads.groups == {}


def test_embedding_cache_resumes_from_the_saved_table(tmp_path: Path) -> None:
    made = rows()[:10]
    embedder = FakeEmbedder()
    table = EmbeddingTable(tmp_path, "fake")
    first = EmbeddingCache(embedder, table, tmp_path).fill(made)
    again = EmbeddingCache(embedder, table, tmp_path).fill(made)
    assert embedder.calls == 10 and set(again) == set(first)
    assert np.allclose(again[made[0].id], [1.0, 0.0])


def test_linear_model_rejects_misaligned_rows() -> None:
    with pytest.raises(ConfigError):
        LinearModel(("a", "b"), ((1.0,),), (0.0, 0.0))
