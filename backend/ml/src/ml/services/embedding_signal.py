"""Signal from image embeddings plus our logistic heads: waste or not, and burning."""

import logging

from ml.domain.case import VerificationCase
from ml.domain.embedding import Embedding
from ml.domain.errors import ConfigError, ExternalServiceError
from ml.domain.insights import HAZARD_MIN, HazardSighting, Insights, InsightSource
from ml.domain.linear import EmbeddingHeads
from ml.domain.verification import SignalResult
from ml.ports.embedding_sink import EmbeddingSink
from ml.ports.image_embedder import ImageEmbedder
from ml.ports.signal import Signal

logger = logging.getLogger(__name__)

# Claims the waste head speaks to; any other claim gets a neutral score combiners skip.
# overflowing_bin stays out: the head never saw a bin, and a damaged bin may show no waste.
WASTE_CLAIMS = frozenset({"waste_dump", "no_bin"})
NEUTRAL = 0.5


class EmbeddingSignal(Signal):
    NAME = "embedding_classifier"
    PROVIDER = "junksnap"
    MODEL = "embedding-type-classifier"

    def __init__(
        self,
        embedder: ImageEmbedder,
        heads: EmbeddingHeads,
        sink: EmbeddingSink | None = None,
        hazard_min: float = HAZARD_MIN,  # ML_EMBEDDING_HAZARD_MIN
    ) -> None:
        self._embedder = embedder
        self._heads = heads
        self._sink = sink  # None in offline scoring, which stores nothing
        self._hazard_min = hazard_min

    def measure(self, case: VerificationCase) -> SignalResult:
        embedding = self._embedder.embed(case.image)
        if embedding.model != self._heads.embedder:
            raise ConfigError(f"heads expect {self._heads.embedder}, got {embedding.model}")
        waste = self._heads.probabilities("report_type", embedding.vector).get("waste_dump")
        claimed = case.claim.report_type in WASTE_CLAIMS and waste is not None
        # The embedder's own file version (its pin) and the heads', e.g. siglip@v2/clf-v3.
        version = f"{embedding.model}@{embedding.version}/{self._heads.version}"
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
            artifact_key=self._stored(case.report_id, embedding),
            neutral=not claimed,
        )

    def _stored(self, case_id: str, embedding: Embedding) -> str | None:
        """A failed write leaves embedding_key null; the verdict does not depend on it."""
        if self._sink is None:
            return None
        try:
            return self._sink.store(case_id, embedding)
        except ExternalServiceError as error:
            logger.warning("embedding_not_stored", extra={"fields": {"reason": str(error)}})
            return None

    def _insights(self, embedding: Embedding, source: InsightSource) -> Insights:
        """Hazards only: material heads give presence, not the measured shares composition needs."""
        hazards = self._heads.probabilities("hazards", embedding.vector)
        return Insights(
            hazards=tuple(
                HazardSighting(h, p, source) for h, p in hazards.items() if p >= self._hazard_min
            ),
        )
