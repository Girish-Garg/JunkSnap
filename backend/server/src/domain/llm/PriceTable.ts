const PER_MILLION = 1_000_000;
const USD_DECIMALS = 1_000_000;

export interface ModelPrice {
  readonly match: string;
  readonly inputUsdPerMillion: number;
  readonly outputUsdPerMillion: number;
}

// On-demand list prices, October 2026; `match` is a substring of the model id and the first match wins.
export const LIST_PRICES: readonly ModelPrice[] = [
  // Bedrock regional profiles of Claude 4.5 and later cost 10% more than the global profile.
  { match: "in.anthropic.claude-haiku-4-5", inputUsdPerMillion: 1.1, outputUsdPerMillion: 5.5 },
  { match: "claude-haiku-4-5", inputUsdPerMillion: 1, outputUsdPerMillion: 5 },
  { match: "claude-sonnet-4-6", inputUsdPerMillion: 3, outputUsdPerMillion: 15 },
  { match: "claude-sonnet-4-5", inputUsdPerMillion: 3, outputUsdPerMillion: 15 },
  { match: "nova-pro", inputUsdPerMillion: 0.8, outputUsdPerMillion: 3.2 },
  { match: "nova-lite", inputUsdPerMillion: 0.06, outputUsdPerMillion: 0.24 },
  { match: "gpt-4.1-mini", inputUsdPerMillion: 0.4, outputUsdPerMillion: 1.6 },
];

// Estimates for the logs only, never for billing.
export class PriceTable {
  readonly #prices: readonly ModelPrice[];

  constructor(prices: readonly ModelPrice[] = LIST_PRICES) {
    this.#prices = prices;
  }

  // null when the model has no listed price.
  costUsd(model: string, inputTokens: number, outputTokens: number): number | null {
    const price = this.#prices.find((entry) => model.includes(entry.match));
    if (price === undefined) {
      return null;
    }
    const usd = (inputTokens * price.inputUsdPerMillion + outputTokens * price.outputUsdPerMillion) / PER_MILLION;
    return Math.round(usd * USD_DECIMALS) / USD_DECIMALS;
  }
}
