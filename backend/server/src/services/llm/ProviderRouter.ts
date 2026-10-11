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

// Leaves letters time for the template fallback inside CloudFront's 60 s.
export const DEFAULT_BUDGET_MS = 45_000;

export interface RouterOptions {
  readonly budgetMs?: number;
}

interface Route<J> {
  readonly request: LlmRequest;
  readonly check: AnswerCheck<J>;
  readonly budget: AbortSignal;
}

// A failed call moves on at once; a rejected answer gets `retries` reminders; nothing new starts once the budget is spent.
export class ProviderRouter {
  readonly #tasks: ReadonlyMap<LlmTask, TaskConfig>;
  readonly #factory: ProviderFactory;
  readonly #log: LlmCallLog;
  readonly #budgetMs: number;

  constructor(tasks: ReadonlyMap<LlmTask, TaskConfig>, factory: ProviderFactory, logger: Logger, options: RouterOptions = {}) {
    this.#tasks = tasks;
    this.#factory = factory;
    this.#log = new LlmCallLog(logger);
    this.#budgetMs = options.budgetMs ?? DEFAULT_BUDGET_MS;
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
    const route = { request, check, budget: AbortSignal.timeout(this.#budgetMs) };
    for (const choice of this.#config(request.task).choices()) {
      this.#guard(route);
      const provider = await this.#provider(route, choice);
      const answer = provider === null ? null : await this.#ask(route, choice, provider);
      if (answer !== null) {
        return answer;
      }
    }
    this.#guard(route);
    throw new ExternalServiceError(`no LLM provider gave a usable answer for task ${request.task}`);
  }

  #config(task: LlmTask): TaskConfig {
    const config = this.#tasks.get(task);
    if (config === undefined) {
      throw new ConfigError(`no TaskConfig for LLM task ${task}`);
    }
    return config;
  }

  #guard<J>(route: Route<J>): void {
    if (route.budget.aborted) {
      throw this.#spent(route);
    }
  }

  #spent<J>(route: Route<J>): ExternalServiceError {
    return new ExternalServiceError(`LLM time budget of ${String(this.#budgetMs)} ms spent for task ${route.request.task}`);
  }

  // Building a provider reads its API key, so it runs inside the budget too.
  async #provider<J>(route: Route<J>, choice: ModelChoice): Promise<LlmProvider | null> {
    const spent = new Promise<never>((_resolve, reject) => {
      route.budget.addEventListener("abort", () => reject(this.#spent(route)), { once: true });
    });
    try {
      const provider = await Promise.race([this.#factory.build(choice), spent]);
      if (provider === null) {
        this.#log.missed(route.request, choice, { outcome: "skipped", reason: "no usable API key", latencyMs: null });
      }
      return provider;
    } catch (error) {
      return this.#missed(route.request, choice, error, null);
    }
  }

  async #ask<J>(route: Route<J>, choice: ModelChoice, provider: LlmProvider): Promise<LlmResponse<J> | null> {
    let attempt = route.request;
    for (let tries = 0; tries <= route.check.retries; tries += 1) {
      this.#guard(route);
      const response = await this.#call(attempt, choice, provider, route.budget);
      if (response === null) {
        return null;
      }
      const accepted = route.check.accept(response);
      this.#log.answered(attempt, response, accepted === null ? route.check.rejection : null);
      if (accepted !== null) {
        return accepted;
      }
      attempt = route.check.remind(route.request);
    }
    return null;
  }

  async #call(request: LlmRequest, choice: ModelChoice, provider: LlmProvider, budget: AbortSignal): Promise<LlmResponse | null> {
    const started = performance.now();
    try {
      return await provider.complete(request, budget);
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
