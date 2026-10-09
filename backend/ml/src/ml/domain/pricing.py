"""Estimated cost per model call from list prices, for the logs only."""

from collections.abc import Mapping
from dataclasses import dataclass
from types import MappingProxyType

from ml.domain.llm import LlmResponse

PER_MILLION = 1_000_000


@dataclass(frozen=True)
class TokenPrice:
    input_usd: float  # per million tokens
    output_usd: float  # per million tokens

    def cost(self, input_tokens: int, output_tokens: int) -> float:
        return (input_tokens * self.input_usd + output_tokens * self.output_usd) / PER_MILLION


# On-demand list prices, October 2026; keys match as substrings of the model id.
LIST_PRICES: Mapping[str, TokenPrice] = MappingProxyType(
    {
        "claude-sonnet-4-6": TokenPrice(3.0, 15.0),
        "claude-sonnet-4-5": TokenPrice(3.0, 15.0),
        "claude-haiku-4-5": TokenPrice(1.0, 5.0),
        "nova-pro": TokenPrice(0.8, 3.2),
        "nova-lite": TokenPrice(0.06, 0.24),
        "gpt-4.1-mini": TokenPrice(0.4, 1.6),
    }
)


class PriceTable:
    def __init__(self, prices: Mapping[str, TokenPrice] = LIST_PRICES) -> None:
        self._prices = dict(prices)

    def estimate_usd(self, response: LlmResponse) -> float | None:
        """None when the model has no known price."""
        for key, price in self._prices.items():
            if key in response.model:
                return round(price.cost(response.input_tokens, response.output_tokens), 6)
        return None
