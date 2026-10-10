"""Signal from image embeddings plus our logistic heads: waste or not, materials, burning."""

from ml.domain.case import VerificationCase
from ml.domain.embedding import Embedding
from ml.domain.errors import ConfigError
from ml.domain.insights import HazardSighting, Insights, InsightSource, MaterialShare
from ml.domain.linear import EmbeddingHeads
from ml.domain.verification import SignalResult
from ml.ports.embedding_sink import EmbeddingSink
from ml.ports.image_embedder import ImageEmbedder
from ml.ports.signal import Signal

# Claims the waste head speaks to; any other claim gets a neutral score the stacker ignores.
WASTE_CLAIMS = frozenset({"waste_dump", "no_bin"})
NEUTRAL = 0.5
MATERIAL_MIN = 0.5
HAZARD_MIN = 0.5


class EmbeddingSignal(Signal):
    NAME = "embedding_classifier"
    PROVIDER = "junksnap"
    MODEL = "embedding-type-classifier"

    def __init__(
        self, embedder: ImageEmbedder, heads: EmbeddingHeads, sink: EmbeddingSink | None = None
    ) -> None:
        self._embedder = embedder
        self._heads = heads
        self._sink = sink  # None in offline scoring, which stores nothing

    def measure(self, case: VerificationCase) -> SignalResult:
        embedding = self._embedder.embed(case.image)
        if embedding.model != self._heads.embedder:
            raise ConfigError(f"heads expect {self._heads.embedder}, got {embedding.model}")
        waste = self._heads.probabilities("report_type", embedding.vector).get("waste_dump")
        claimed = case.claim.report_type in WASTE_CLAIMS and waste is not None
        version = f"{embedding.model}/{self._heads.version}"
        source = InsightSource(self.NAME, self.PROVIDER, self.MODEL, version)
        return SignalResult(
            name=self.NAME,
            score=case.purpose.support(waste if claimed and waste is not None else NEUTRAL),
            provider=self.PROVIDER,
            model=self.MODEL,
            version=version,
            latency_ms=embedding.latency_ms,
            notes=(f"waste {waste:.2f}",) if waste is not None else (),
            insights=self._insights(embedding, source),
            artifact_key=self._sink.store(case.report_id, embedding) if self._sink else None,
        )

    def _insights(self, embedding: Embedding, source: InsightSource) -> Insights:
        materials = self._heads.probabilities("materials", embedding.vector)
        seen = {m: p for m, p in materials.items() if p >= MATERIAL_MIN}
        total = sum(seen.values())
        shares = {m: p / total for m, p in seen.items()} if total else {}
        hazards = self._heads.probabilities("hazards", embedding.vector)
        return Insights(
            composition=MaterialShare.from_weights(shares, source),
            hazards=tuple(
                HazardSighting(h, p, source) for h, p in hazards.items() if p >= HAZARD_MIN
            ),
        )
