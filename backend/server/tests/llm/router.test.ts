import { describe, expect, it } from "vitest";
import { z } from "zod";
import { OpenAiProviderBuilder } from "../../src/adapters/llm/OpenAiProviderBuilder.js";
import { ExternalServiceError, InternalDataError } from "../../src/domain/errors.js";
import { LlmRequest } from "../../src/domain/llm/LlmRequest.js";
import type { LlmTask } from "../../src/domain/llm/LlmTask.js";
import { ModelChoice } from "../../src/domain/llm/ModelChoice.js";
import { PriceTable } from "../../src/domain/llm/PriceTable.js";
import { TaskConfig } from "../../src/domain/llm/TaskConfig.js";
import type { ProviderBuilder } from "../../src/ports/ProviderBuilder.js";
import { ProviderFactory } from "../../src/services/llm/ProviderFactory.js";
import { ProviderRouter } from "../../src/services/llm/ProviderRouter.js";
import { LogSink } from "../LogSink.js";
import { errorReply, FakeFetch, FakeLlmProvider, FakeProviderBuilder, FakeSecretReader, HANG, llmLines, testLogger } from "./fakes.js";
import { RETRY, TIMEOUTS } from "../defaults.js";

const SONNET = "global.anthropic.claude-sonnet-4-6";
const HAIKU = "in.anthropic.claude-haiku-4-5-20251001-v1:0";
const NOVA = "apac.amazon.nova-pro-v1:0";
const KEY = "sk-test-0123456789abcdefghijklmnop";
const Word = z.object({ word: z.string() });
const accessDenied = () => new ExternalServiceError(`bedrock ${SONNET}: AccessDeniedException: use case form not submitted`);

function routerFor(config: TaskConfig, builders: ProviderBuilder[], sink: LogSink, budgetMs = TIMEOUTS.llm.budgetMs): ProviderRouter {
  const tasks = new Map<LlmTask, TaskConfig>([["letters", config]]);
  return new ProviderRouter(tasks, new ProviderFactory(builders), testLogger(sink), { budgetMs, jsonRetries: RETRY.jsonRetries });
}

function bedrockOnly(providers: Record<string, FakeLlmProvider>, sink: LogSink, budgetMs?: number): ProviderRouter {
  const [first = "", ...rest] = Object.keys(providers);
  const config = new TaskConfig("bedrock", first, rest.map((model) => new ModelChoice("bedrock", model)));
  return routerFor(config, [new FakeProviderBuilder("bedrock", providers)], sink, budgetMs);
}

function jsonRequest(): LlmRequest {
  return new LlmRequest({ task: "letters", system: "You check words.", userText: "Say ok.", jsonSchemaName: "word" });
}

describe("ProviderRouter fallback", () => {
  it("moves to the next provider when a call fails", async () => {
    const sink = new LogSink();
    const router = bedrockOnly({ [SONNET]: new FakeLlmProvider("bedrock", SONNET, [accessDenied()]), [NOVA]: new FakeLlmProvider("bedrock", NOVA, ["ok"]) }, sink);
    const response = await router.complete(new LlmRequest({ task: "letters", system: "s", userText: "Say ok." }));
    expect(response).toMatchObject({ text: "ok", provider: "bedrock", model: NOVA });
    expect(llmLines(sink).map((line) => [line.model, line.outcome])).toEqual([
      [SONNET, "error"],
      [NOVA, "ok"],
    ]);
    expect(llmLines(sink)[0]).toMatchObject({ level: "WARN", reason: expect.stringContaining("AccessDeniedException") });
  });

  it("retries once with a reminder on invalid JSON, then falls through", async () => {
    const sink = new LogSink();
    const sonnet = new FakeLlmProvider("bedrock", SONNET, ["Sure! here it is", '{"word": 3}']);
    const nova = new FakeLlmProvider("bedrock", NOVA, ['```json\n{"word": "ok"}\n```']);
    const response = await bedrockOnly({ [SONNET]: sonnet, [NOVA]: nova }, sink).completeJson(jsonRequest(), Word);
    expect(response.json).toEqual({ word: "ok" });
    expect(response.model).toBe(NOVA);
    expect(sonnet.requests).toHaveLength(2);
    expect(sonnet.requests[1]?.userText).toMatch(/^Say ok\.\n\nYour previous answer was not valid JSON for the word schema/);
    expect(llmLines(sink).map((line) => line.outcome)).toEqual(["invalid_json", "invalid_json", "ok"]);
  });

  it("keeps the same provider when the reminder fixes the answer", async () => {
    const sink = new LogSink();
    const sonnet = new FakeLlmProvider("bedrock", SONNET, ["not json", '{"word": "ok"}']);
    const nova = new FakeLlmProvider("bedrock", NOVA, []);
    const response = await bedrockOnly({ [SONNET]: sonnet, [NOVA]: nova }, sink).completeJson(jsonRequest(), Word);
    expect(response).toMatchObject({ model: SONNET, json: { word: "ok" } });
    expect(nova.requests).toHaveLength(0);
  });

  it("moves on from a blank text answer without a retry", async () => {
    const sink = new LogSink();
    const sonnet = new FakeLlmProvider("bedrock", SONNET, ["  "]);
    const router = bedrockOnly({ [SONNET]: sonnet, [NOVA]: new FakeLlmProvider("bedrock", NOVA, ["ok"]) }, sink);
    await expect(router.complete(new LlmRequest({ task: "letters", system: "s", userText: "u" }))).resolves.toMatchObject({ model: NOVA });
    expect(sonnet.requests).toHaveLength(1);
    expect(llmLines(sink).map((line) => line.outcome)).toEqual(["empty_answer", "ok"]);
  });

  it("throws ExternalServiceError when every provider fails", async () => {
    const sink = new LogSink();
    const router = bedrockOnly({ [SONNET]: new FakeLlmProvider("bedrock", SONNET, [accessDenied()]), [HAIKU]: new FakeLlmProvider("bedrock", HAIKU, ["x", "y"]) }, sink);
    await expect(router.completeJson(jsonRequest(), Word)).rejects.toThrow(ExternalServiceError);
    expect(llmLines(sink).map((line) => line.outcome)).toEqual(["error", "invalid_json", "invalid_json"]);
  });

  it("lets a programming error through instead of falling back", async () => {
    const router = bedrockOnly({ [SONNET]: new FakeLlmProvider("bedrock", SONNET, [new TypeError("bug")]) }, new LogSink());
    await expect(router.complete(jsonRequest())).rejects.toThrow(TypeError);
  });

  it("refuses completeJson without a schema name", async () => {
    const router = bedrockOnly({ [SONNET]: new FakeLlmProvider("bedrock", SONNET, []) }, new LogSink());
    const request = new LlmRequest({ task: "letters", system: "s", userText: "u" });
    await expect(router.completeJson(request, Word)).rejects.toThrow(InternalDataError);
  });
});

describe("ProviderRouter time budget", () => {
  it("defaults to 45 s and hands the budget signal to each provider", async () => {
    const sonnet = new FakeLlmProvider("bedrock", SONNET, ["ok"]);
    await bedrockOnly({ [SONNET]: sonnet }, new LogSink()).complete(jsonRequest());
    expect(TIMEOUTS.llm.budgetMs).toBe(45_000);
    expect(sonnet.budgets[0]).toBeInstanceOf(AbortSignal);
    expect(sonnet.budgets[0]?.aborted).toBe(false);
  });

  it("aborts the call in flight and starts no next provider once the budget is spent", async () => {
    const sink = new LogSink();
    const nova = new FakeLlmProvider("bedrock", NOVA, ["ok"]);
    const router = bedrockOnly({ [SONNET]: new FakeLlmProvider("bedrock", SONNET, [HANG]), [NOVA]: nova }, sink, 30);
    await expect(router.complete(jsonRequest())).rejects.toThrow(new ExternalServiceError("LLM time budget of 30 ms spent for task letters"));
    expect(nova.requests).toHaveLength(0);
    expect(llmLines(sink).map((line) => [line.model, line.outcome])).toEqual([[SONNET, "error"]]);
  });

  it("counts a hung provider build (the API key read) against the budget", async () => {
    const hung: ProviderBuilder = { provider: "openai", build: async () => new Promise(() => undefined) };
    const nova = new FakeLlmProvider("bedrock", NOVA, ["ok"]);
    const config = new TaskConfig("openai", "gpt-4.1-mini", [new ModelChoice("bedrock", NOVA)]);
    const router = routerFor(config, [hung, new FakeProviderBuilder("bedrock", { [NOVA]: nova })], new LogSink(), 30);
    await expect(router.complete(jsonRequest())).rejects.toThrow(new ExternalServiceError("LLM time budget of 30 ms spent for task letters"));
    expect(nova.requests).toHaveLength(0);
  });

  it("starts no retry once the budget is spent", async () => {
    const sink = new LogSink();
    const sonnet = new FakeLlmProvider("bedrock", SONNET, [{ afterMs: 60, answer: "not json" }, '{"word": "ok"}']);
    const router = bedrockOnly({ [SONNET]: sonnet }, sink, 30);
    await expect(router.completeJson(jsonRequest(), Word)).rejects.toThrow(/time budget of 30 ms spent/);
    expect(sonnet.requests).toHaveLength(1);
    expect(llmLines(sink).map((line) => line.outcome)).toEqual(["invalid_json"]);
  });
});

describe("ProviderRouter with OpenAI", () => {
  function openAiFirst(secrets: FakeSecretReader, sink: LogSink, fetch = new FakeFetch()): ProviderRouter {
    const source = { fetch: fetch.fetch as typeof globalThis.fetch, secrets, secretId: "junksnap/dev/openai-api-key", prices: new PriceTable(), timeoutMs: 1000 };
    const nova = new FakeLlmProvider("bedrock", NOVA, ['{"word": "nova"}', '{"word": "nova"}']);
    const config = new TaskConfig("openai", "gpt-4.1-mini", [new ModelChoice("bedrock", NOVA)]);
    return routerFor(config, [new OpenAiProviderBuilder(source), new FakeProviderBuilder("bedrock", { [NOVA]: nova })], sink);
  }

  it.each([null, "", "placeholder-set-me-later-please", "<openai key here, typed by a person>", "sk-short"])(
    "skips OpenAI and logs it when the key is %j",
    async (value) => {
      const sink = new LogSink();
      const response = await openAiFirst(new FakeSecretReader(value), sink).completeJson(jsonRequest(), Word);
      expect(response.json).toEqual({ word: "nova" });
      expect(llmLines(sink)[0]).toMatchObject({ provider: "openai", outcome: "skipped", reason: "no usable API key" });
    },
  );

  it("logs an error line and moves on when the secret read fails", async () => {
    const sink = new LogSink();
    const denied = new ExternalServiceError("secret junksnap/dev/openai-api-key unreadable: AccessDeniedException");
    const response = await openAiFirst(new FakeSecretReader(denied), sink).completeJson(jsonRequest(), Word);
    expect(response.json).toEqual({ word: "nova" });
    expect(llmLines(sink)[0]).toMatchObject({ provider: "openai", outcome: "error", reason: expect.stringContaining("AccessDeniedException") });
  });

  it("never caches a missing key, so a key stored later is used", async () => {
    const secrets = new FakeSecretReader(null);
    const fetch = new FakeFetch();
    const router = openAiFirst(secrets, new LogSink(), fetch);
    await router.completeJson(jsonRequest(), Word);
    secrets.value = KEY;
    const response = await router.completeJson(jsonRequest(), Word);
    await router.completeJson(jsonRequest(), Word);
    expect(response).toMatchObject({ provider: "openai", model: "gpt-4.1-mini", version: "2025-04-14", json: { word: "openai" } });
    expect(secrets.reads).toBe(2);
    expect(fetch.calls.map((call) => call.url)).toEqual(["https://api.openai.com/v1/chat/completions", "https://api.openai.com/v1/chat/completions"]);
  });

  it("drops a key OpenAI rejects with 401, so a corrected secret is read on the next call", async () => {
    const sink = new LogSink();
    const secrets = new FakeSecretReader(KEY);
    const fetch = new FakeFetch([errorReply(401, "invalid_api_key")]);
    const router = openAiFirst(secrets, sink, fetch);
    await expect(router.completeJson(jsonRequest(), Word)).resolves.toMatchObject({ json: { word: "nova" } });
    secrets.value = "sk-test-corrected-0123456789abcdef";
    await expect(router.completeJson(jsonRequest(), Word)).resolves.toMatchObject({ provider: "openai" });
    expect(secrets.reads).toBe(2);
    expect(fetch.calls.map((call) => call.authorization)).toEqual([`Bearer ${KEY}`, "Bearer sk-test-corrected-0123456789abcdef"]);
    expect(llmLines(sink)[0]).toMatchObject({ outcome: "error", reason: "openai gpt-4.1-mini: HTTP 401 invalid_api_key" });
  });

  it("logs task, provider, model, version, latency, tokens, cost and outcome, but no prompt, image or key", async () => {
    const sink = new LogSink();
    const image = { bytes: new TextEncoder().encode("IMAGE-BYTES-MARKER"), format: "jpeg" as const };
    const request = new LlmRequest({ task: "letters", system: "SYSTEM-MARKER", userText: "USER-MARKER", images: [image], jsonSchemaName: "word" });
    await openAiFirst(new FakeSecretReader(KEY), sink).completeJson(request, Word);
    const [line] = llmLines(sink);
    expect(line).toMatchObject({
      task: "letters",
      schema: "word",
      provider: "openai",
      model: "gpt-4.1-mini",
      version: "2025-04-14",
      latency_ms: expect.any(Number),
      input_tokens: 40,
      output_tokens: 2,
      cost_usd: 0.000019,
      outcome: "ok",
      images: 1,
    });
    const text = JSON.stringify(sink.records());
    for (const secret of ["SYSTEM-MARKER", "USER-MARKER", "IMAGE-BYTES-MARKER", Buffer.from(image.bytes).toString("base64"), KEY]) {
      expect(text).not.toContain(secret);
    }
  });
});
