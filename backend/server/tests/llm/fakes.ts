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

export type Scripted = string | Error;

// Answers from a script, one entry per call; records every request it saw.
export class FakeLlmProvider implements LlmProvider {
  readonly requests: LlmRequest[] = [];
  readonly #provider: ProviderName;
  readonly #model: string;
  readonly #script: Scripted[];

  constructor(provider: ProviderName, model: string, script: Scripted[]) {
    this.#provider = provider;
    this.#model = model;
    this.#script = [...script];
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    this.requests.push(request);
    const next = this.#script.shift() ?? new ExternalServiceError(`${this.#model}: script ran out`);
    if (next instanceof Error) {
      throw next;
    }
    return LlmResponse.of({
      text: next,
      provider: this.#provider,
      model: this.#model,
      version: "test-1",
      latencyMs: 12,
      inputTokens: 1000,
      outputTokens: 500,
      costUsd: new PriceTable().costUsd(this.#model, 1000, 500),
    });
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
  value: string | null;

  constructor(value: string | null) {
    this.value = value;
  }

  async read(): Promise<string | null> {
    this.reads += 1;
    return this.value;
  }
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
