import { setTimeout as sleep } from "node:timers/promises";
import type { Logger } from "pino";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import { ExternalServiceError } from "../../src/domain/errors.js";
import type { LlmRequest } from "../../src/domain/llm/LlmRequest.js";
import { LlmResponse } from "../../src/domain/llm/LlmResponse.js";
import type { ProviderName } from "../../src/domain/llm/LlmTask.js";
import { PriceTable } from "../../src/domain/llm/PriceTable.js";
import type { LlmProvider } from "../../src/ports/LlmProvider.js";
import type { ProviderBuilder } from "../../src/ports/ProviderBuilder.js";
import type { SecretReader } from "../../src/ports/SecretReader.js";
import type { LogSink } from "../LogSink.js";

// Waits until the router's budget aborts, as a real adapter does.
export const HANG = Symbol("hang");

export interface Late {
  readonly afterMs: number;
  readonly answer: string;
}

export type Scripted = string | Error | Late | typeof HANG;

function untilAborted(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    const fail = () => reject(new ExternalServiceError(`aborted: ${String(signal.reason)}`));
    if (signal.aborted) {
      fail();
    }
    signal.addEventListener("abort", fail, { once: true });
  });
}

// Answers from a script, one entry per call; records every request and budget it saw.
export class FakeLlmProvider implements LlmProvider {
  readonly requests: LlmRequest[] = [];
  readonly budgets: AbortSignal[] = [];
  readonly #provider: ProviderName;
  readonly #model: string;
  readonly #script: Scripted[];

  constructor(provider: ProviderName, model: string, script: Scripted[]) {
    this.#provider = provider;
    this.#model = model;
    this.#script = [...script];
  }

  async complete(request: LlmRequest, budget: AbortSignal): Promise<LlmResponse> {
    this.requests.push(request);
    this.budgets.push(budget);
    const text = await FakeLlmProvider.#play(this.#script.shift() ?? new ExternalServiceError(`${this.#model}: script ran out`), budget);
    return LlmResponse.of({
      text,
      provider: this.#provider,
      model: this.#model,
      version: "test-1",
      latencyMs: 12,
      inputTokens: 1000,
      outputTokens: 500,
      costUsd: new PriceTable().costUsd(this.#model, 1000, 500),
    });
  }

  static async #play(next: Scripted, budget: AbortSignal): Promise<string> {
    if (next === HANG) {
      return untilAborted(budget);
    }
    if (next instanceof Error) {
      throw next;
    }
    if (typeof next === "string") {
      return next;
    }
    await sleep(next.afterMs);
    return next.answer;
  }
}

export class FakeProviderBuilder implements ProviderBuilder {
  readonly provider: ProviderName;
  readonly #providers: ReadonlyMap<string, FakeLlmProvider>;

  constructor(provider: ProviderName, providers: Record<string, FakeLlmProvider>) {
    this.provider = provider;
    this.#providers = new Map(Object.entries(providers));
  }

  async build(model: string): Promise<LlmProvider | null> {
    return this.#providers.get(model) ?? null;
  }
}

export class FakeSecretReader implements SecretReader {
  reads = 0;
  value: string | null | Error;

  constructor(value: string | null | Error) {
    this.value = value;
  }

  async read(): Promise<string | null> {
    this.reads += 1;
    if (this.value instanceof Error) {
      throw this.value;
    }
    return this.value;
  }
}

// Replies from a queue, then with a valid answer; records the URL and bearer of each call.
export class FakeFetch {
  readonly calls: { readonly url: string; readonly authorization: string | null }[] = [];
  readonly #replies: Response[];

  constructor(replies: Response[] = []) {
    this.#replies = [...replies];
  }

  readonly fetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    this.calls.push({ url: String(url), authorization: new Headers(init?.headers).get("authorization") });
    return this.#replies.shift() ?? chatReply('{"word": "openai"}');
  };
}

export function testLogger(sink: LogSink): Logger {
  return new JsonLoggerFactory(sink).create({ service: "api", stage: "dev" });
}

export function llmLines(sink: LogSink): Record<string, unknown>[] {
  return sink.records().filter((record) => record.message === "llm_call");
}

export function chatReply(content: string, status = 200): Response {
  const body = { model: "gpt-4.1-mini-2025-04-14", choices: [{ message: { content } }], usage: { prompt_tokens: 40, completion_tokens: 2 } };
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export function errorReply(status: number, code: string): Response {
  const body = { error: { message: "Incorrect API key provided: sk-test-****mnop", type: "invalid_request_error", code } };
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
