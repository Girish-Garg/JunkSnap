import { ConfigError, ExternalServiceError, InternalDataError } from "../../domain/errors.js";
import type { AnswerSchema } from "../../domain/llm/AnswerSchema.js";
import type { LlmRequest } from "../../domain/llm/LlmRequest.js";
import type { LlmResponse } from "../../domain/llm/LlmResponse.js";
import type { LlmTask } from "../../domain/llm/LlmTask.js";
import type { ModelChoice } from "../../domain/llm/ModelChoice.js";
import type { TaskConfig } from "../../domain/llm/TaskConfig.js";
import type { Logger } from "../../ports/Logger.js";
import type { LlmProvider } from "../../ports/LlmProvider.js";
import type { AnswerCheck } from "./AnswerCheck.js";
import { JsonAnswer } from "./JsonAnswer.js";
import { LlmCallLog } from "./LlmCallLog.js";
import type { ProviderFactory } from "./ProviderFactory.js";
import { TextAnswer } from "./TextAnswer.js";

// A failed call moves on at once; an answer that fails its check gets `retries` reminders first.
export class ProviderRouter {
  readonly #tasks: ReadonlyMap<LlmTask, TaskConfig>;
  readonly #factory: ProviderFactory;
  readonly #log: LlmCallLog;

  constructor(tasks: ReadonlyMap<LlmTask, TaskConfig>, factory: ProviderFactory, logger: Logger) {
    this.#tasks = tasks;
    this.#factory = factory;
    this.#log = new LlmCallLog(logger);
  }

  complete(request: LlmRequest): Promise<LlmResponse> {
    return this.#route(request, new TextAnswer());
  }

  async completeJson<T>(request: LlmRequest, schema: AnswerSchema<T>): Promise<LlmResponse<T>> {
    if (!request.expectsJson()) {
      throw new InternalDataError(`completeJson needs a jsonSchemaName (task ${request.task})`);
    }
    return this.#route(request, new JsonAnswer(schema));
  }

  async #route<J>(request: LlmRequest, check: AnswerCheck<J>): Promise<LlmResponse<J>> {
    for (const choice of this.#config(request.task).choices()) {
      const provider = await this.#provider(request, choice);
      const answer = provider === null ? null : await this.#ask(request, choice, provider, check);
      if (answer !== null) {
        return answer;
      }
    }
    throw new ExternalServiceError(`no LLM provider gave a usable answer for task ${request.task}`);
  }

  #config(task: LlmTask): TaskConfig {
    const config = this.#tasks.get(task);
    if (config === undefined) {
      throw new ConfigError(`no TaskConfig for LLM task ${task}`);
    }
    return config;
  }

  async #provider(request: LlmRequest, choice: ModelChoice): Promise<LlmProvider | null> {
    try {
      const provider = await this.#factory.build(choice);
      if (provider === null) {
        this.#log.missed(request, choice, { outcome: "skipped", reason: "no usable API key", latencyMs: null });
      }
      return provider;
    } catch (error) {
      return this.#missed(request, choice, error, null);
    }
  }

  async #ask<J>(
    request: LlmRequest,
    choice: ModelChoice,
    provider: LlmProvider,
    check: AnswerCheck<J>,
  ): Promise<LlmResponse<J> | null> {
    let attempt = request;
    for (let tries = 0; tries <= check.retries; tries += 1) {
      const response = await this.#call(attempt, choice, provider);
      if (response === null) {
        return null;
      }
      const accepted = check.accept(response);
      this.#log.answered(attempt, response, accepted === null ? check.rejection : null);
      if (accepted !== null) {
        return accepted;
      }
      attempt = check.remind(request);
    }
    return null;
  }

  async #call(request: LlmRequest, choice: ModelChoice, provider: LlmProvider): Promise<LlmResponse | null> {
    const started = performance.now();
    try {
      return await provider.complete(request);
    } catch (error) {
      return this.#missed(request, choice, error, Math.round(performance.now() - started));
    }
  }

  #missed(request: LlmRequest, choice: ModelChoice, error: unknown, latencyMs: number | null): null {
    if (!(error instanceof ExternalServiceError)) {
      throw error;
    }
    this.#log.missed(request, choice, { outcome: "error", reason: error.message, latencyMs });
    return null;
  }
}
