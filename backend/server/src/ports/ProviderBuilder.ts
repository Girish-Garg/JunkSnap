import type { ProviderName } from "../domain/llm/LlmTask.js";
import type { LlmProvider } from "./LlmProvider.js";

export interface ProviderBuilder {
  readonly provider: ProviderName;
  // null when the provider is not usable right now, for example while its API key is missing.
  build(model: string): Promise<LlmProvider | null>;
}
