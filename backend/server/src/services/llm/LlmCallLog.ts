import type { LlmRequest } from "../../domain/llm/LlmRequest.js";
import type { LlmResponse } from "../../domain/llm/LlmResponse.js";
import type { ModelChoice } from "../../domain/llm/ModelChoice.js";
import type { Logger } from "../../ports/Logger.js";
import type { Rejection } from "./AnswerCheck.js";

const MESSAGE = "llm_call";

export interface Miss {
  readonly outcome: "error" | "skipped";
  readonly reason: string;
  readonly latencyMs: number | null;
}

// One line per provider attempt; never prompt text, images or keys.
export class LlmCallLog {
  readonly #logger: Logger;

  constructor(logger: Logger) {
    this.#logger = logger;
  }

  answered(request: LlmRequest, response: LlmResponse, rejection: Rejection | null): void {
    const line = {
      ...LlmCallLog.#call(request, response),
      version: response.version,
      latency_ms: response.latencyMs,
      input_tokens: response.inputTokens,
      output_tokens: response.outputTokens,
      cost_usd: response.costUsd,
      outcome: rejection ?? "ok",
    };
    if (rejection === null) {
      this.#logger.info(line, MESSAGE);
    } else {
      this.#logger.warn(line, MESSAGE);
    }
  }

  missed(request: LlmRequest, choice: ModelChoice, miss: Miss): void {
    const line = {
      ...LlmCallLog.#call(request, choice),
      version: null,
      latency_ms: miss.latencyMs,
      input_tokens: null,
      output_tokens: null,
      cost_usd: null,
      outcome: miss.outcome,
      reason: miss.reason,
    };
    this.#logger.warn(line, MESSAGE);
  }

  static #call(request: LlmRequest, choice: Pick<ModelChoice, "provider" | "model">): object {
    return {
      task: request.task,
      schema: request.jsonSchemaName ?? null,
      provider: choice.provider,
      model: choice.model,
      images: request.images.length,
    };
  }
}
