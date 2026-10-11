import { BedrockProviderBuilder } from "../../adapters/llm/BedrockProviderBuilder.js";
import type { ConverseClient } from "../../adapters/llm/BedrockConverseProvider.js";
import { ModelChoice } from "../../domain/llm/ModelChoice.js";
import { PriceTable } from "../../domain/llm/PriceTable.js";
import { TaskConfig } from "../../domain/llm/TaskConfig.js";
import type { Logger } from "../../ports/Logger.js";
import { ProviderFactory } from "../../services/llm/ProviderFactory.js";
import { ProviderRouter } from "../../services/llm/ProviderRouter.js";
import type { LlmTimeouts } from "../../settings/TimeoutSettings.js";

// Notes can hold personal data, so they stay on Bedrock whatever LLM_TASKS says: Haiku India profile, then Nova Pro APAC.
export const NOTE_TASK = new TaskConfig("bedrock", "in.anthropic.claude-haiku-4-5-20251001-v1:0", [
  new ModelChoice("bedrock", "apac.amazon.nova-pro-v1:0"),
]);

// A router that knows only the note tasks (moderation, analysis) and only the Bedrock provider.
export class NoteRouterBuilder {
  readonly #client: ConverseClient;
  readonly #timeouts: LlmTimeouts;

  // timeouts: TimeoutSettings.notes (NOTE_LLM_CALL_TIMEOUT_MS, NOTE_LLM_BUDGET_MS).
  constructor(client: ConverseClient, timeouts: LlmTimeouts) {
    this.#client = client;
    this.#timeouts = timeouts;
  }

  build(logger: Logger): ProviderRouter {
    const bedrock = new BedrockProviderBuilder(this.#client, new PriceTable(), this.#timeouts.callMs);
    const tasks = new Map([["note_moderation", NOTE_TASK] as const, ["note_analysis", NOTE_TASK] as const]);
    return new ProviderRouter(tasks, new ProviderFactory([bedrock]), logger, { budgetMs: this.#timeouts.budgetMs });
  }
}
