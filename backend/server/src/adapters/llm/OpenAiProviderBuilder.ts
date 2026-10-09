import { ApiKey } from "../../domain/llm/ApiKey.js";
import type { ProviderName } from "../../domain/llm/LlmTask.js";
import type { PriceTable } from "../../domain/llm/PriceTable.js";
import type { LlmProvider } from "../../ports/LlmProvider.js";
import type { ProviderBuilder } from "../../ports/ProviderBuilder.js";
import type { SecretReader } from "../../ports/SecretReader.js";
import { OpenAiProvider } from "./OpenAiProvider.js";

export interface OpenAiSource {
  readonly fetch: typeof fetch;
  readonly secrets: SecretReader;
  readonly secretId: string;
  readonly prices: PriceTable;
  readonly timeoutMs: number;
}

// Keeps only a usable key and drops it on a 401, so a key stored or corrected later works without a restart.
export class OpenAiProviderBuilder implements ProviderBuilder {
  readonly provider: ProviderName = "openai";
  readonly #source: OpenAiSource;
  #key: ApiKey | null = null;

  constructor(source: OpenAiSource) {
    this.#source = source;
  }

  async build(model: string): Promise<LlmProvider | null> {
    const key = this.#key ?? ApiKey.fromSecret(await this.#source.secrets.read(this.#source.secretId));
    if (key === null) {
      return null;
    }
    this.#key = key;
    const { fetch, prices, timeoutMs } = this.#source;
    return new OpenAiProvider({ fetch, key, model, prices, timeoutMs, rejectKey: () => this.#forget(key) });
  }

  #forget(key: ApiKey): void {
    if (this.#key === key) {
      this.#key = null;
    }
  }
}
