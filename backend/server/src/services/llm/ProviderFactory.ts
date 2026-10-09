import { ConfigError } from "../../domain/errors.js";
import type { ProviderName } from "../../domain/llm/LlmTask.js";
import type { ModelChoice } from "../../domain/llm/ModelChoice.js";
import type { LlmProvider } from "../../ports/LlmProvider.js";
import type { ProviderBuilder } from "../../ports/ProviderBuilder.js";

// A new provider is a new ProviderBuilder registered here, never a branch in the router.
export class ProviderFactory {
  readonly #builders: ReadonlyMap<ProviderName, ProviderBuilder>;

  constructor(builders: readonly ProviderBuilder[]) {
    this.#builders = new Map(builders.map((builder) => [builder.provider, builder]));
  }

  async build(choice: ModelChoice): Promise<LlmProvider | null> {
    const builder = this.#builders.get(choice.provider);
    if (builder === undefined) {
      throw new ConfigError(`no LLM provider builder registered for ${choice.provider}`);
    }
    return builder.build(choice.model);
  }
}
