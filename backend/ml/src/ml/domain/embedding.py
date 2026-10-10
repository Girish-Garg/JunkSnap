"""One image embedding and the model that made it."""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Embedding:
    vector: tuple[float, ...] = field(repr=False)
    model: str
    version: str
    latency_ms: int

    def to_contract(self) -> dict[str, object]:
        """The stored shape at `embeddings/{id}.json` (contracts/README.md)."""
        return {"model": self.model, "dim": len(self.vector), "vector": list(self.vector)}
