import type { ProviderName } from "../../domain/llm/LlmTask.js";
import type { PriceTable } from "../../domain/llm/PriceTable.js";
import type { LlmProvider } from "../../ports/LlmProvider.js";
import type { ProviderBuilder } from "../../ports/ProviderBuilder.js";
import { BedrockConverseProvider, type ConverseClient } from "./BedrockConverseProvider.js";

// Bedrock needs no key: EKS Pod Identity or the CLI profile signs every call.
export class BedrockProviderBuilder implements ProviderBuilder {
  readonly provider: ProviderName = "bedrock";
  readonly #client: ConverseClient;
  readonly #prices: PriceTable;
  readonly #timeoutMs: number;

  constructor(client: ConverseClient, prices: PriceTable, timeoutMs: number) {
    this.#client = client;
    this.#prices = prices;
    this.#timeoutMs = timeoutMs;
  }

  async build(model: string): Promise<LlmProvider> {
    return new BedrockConverseProvider({ client: this.#client, model, prices: this.#prices, timeoutMs: this.#timeoutMs });
  }
}
