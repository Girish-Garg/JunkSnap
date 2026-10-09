import type { ConverseCommand, ConverseCommandOutput } from "@aws-sdk/client-bedrock-runtime";
import type { GetSecretValueCommandOutput } from "@aws-sdk/client-secrets-manager";
import { describe, expect, it } from "vitest";
import { BedrockConverseProvider, type ConverseClient } from "../../src/adapters/llm/BedrockConverseProvider.js";
import { OpenAiProvider } from "../../src/adapters/llm/OpenAiProvider.js";
import { bedrockVersion, openAiVersion } from "../../src/adapters/llm/utils.js";
import { SecretsManagerSecretReader } from "../../src/adapters/SecretsManagerSecretReader.js";
import { ExternalServiceError } from "../../src/domain/errors.js";
import { ApiKey } from "../../src/domain/llm/ApiKey.js";
import { LlmRequest } from "../../src/domain/llm/LlmRequest.js";
import { PriceTable } from "../../src/domain/llm/PriceTable.js";
import { chatReply, errorReply } from "./fakes.js";

const NOVA = "apac.amazon.nova-pro-v1:0";
const IMAGE = { bytes: new Uint8Array([255, 216, 255]), format: "jpeg" as const };
const REQUEST = new LlmRequest({ task: "brands", system: "Read labels.", userText: "What brand?", images: [IMAGE], jsonSchemaName: "brand" });
const KEY_TEXT = "sk-test-0123456789abcdefghijklmnop";
const OPEN = new AbortController().signal;
const HANG = Symbol("hang");

type ConverseAnswer = ConverseCommandOutput | Error | typeof HANG;

// Rejects with the signal's reason once it aborts, like fetch and the AWS SDK.
function untilAborted(signal: AbortSignal | undefined): Promise<never> {
  return new Promise((_resolve, reject) => {
    signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}

class FakeConverseClient implements ConverseClient {
  readonly commands: ConverseCommand[] = [];
  readonly signals: (AbortSignal | undefined)[] = [];
  readonly #answer: ConverseAnswer;

  constructor(answer: ConverseAnswer) {
    this.#answer = answer;
  }

  async send(command: ConverseCommand, options?: { abortSignal?: AbortSignal }): Promise<ConverseCommandOutput> {
    this.commands.push(command);
    this.signals.push(options?.abortSignal);
    if (this.#answer === HANG) {
      return untilAborted(options?.abortSignal);
    }
    if (this.#answer instanceof Error) {
      throw this.#answer;
    }
    return this.#answer;
  }
}

function converseOutput(texts: string[]): ConverseCommandOutput {
  return {
    output: { message: { role: "assistant", content: texts.map((text) => ({ text })) } },
    stopReason: "end_turn",
    usage: { inputTokens: 2294, outputTokens: 149, totalTokens: 2443 },
    metrics: { latencyMs: 900 },
    $metadata: {},
  };
}

function awsError(name: string, message: string): Error {
  return Object.assign(new Error(message), { name });
}

function bedrock(client: FakeConverseClient, model = NOVA): BedrockConverseProvider {
  return new BedrockConverseProvider({ client, model, prices: new PriceTable(), timeoutMs: 1000 });
}

describe("BedrockConverseProvider", () => {
  it("sends system, image then text, and inference settings to Converse", async () => {
    const client = new FakeConverseClient(converseOutput(['{"brand":', ' "x"}']));
    const response = await bedrock(client).complete(REQUEST, OPEN);
    expect(client.commands[0]?.input).toEqual({
      modelId: NOVA,
      system: [{ text: expect.stringMatching(/^Read labels\.\n\nReply with one JSON object for the brand schema/) }],
      messages: [{ role: "user", content: [{ image: { format: "jpeg", source: { bytes: IMAGE.bytes } } }, { text: "What brand?" }] }],
      inferenceConfig: { maxTokens: 1024, temperature: 0 },
    });
    expect(response).toMatchObject({ text: '{"brand": "x"}', provider: "bedrock", version: "v1:0", inputTokens: 2294, outputTokens: 149, costUsd: 0.002312 });
  });

  it("passes an abort signal that fires when the router's budget ends", async () => {
    const client = new FakeConverseClient(HANG);
    const budget = new AbortController();
    const call = bedrock(client).complete(REQUEST, budget.signal);
    expect(client.signals[0]).toBeInstanceOf(AbortSignal);
    expect(client.signals[0]?.aborted).toBe(false);
    budget.abort(new Error("budget spent"));
    await expect(call).rejects.toThrow(new ExternalServiceError(`bedrock ${NOVA}: Error: budget spent`));
    expect(client.signals[0]?.aborted).toBe(true);
  });

  it("turns an SDK error into ExternalServiceError with its name", async () => {
    const client = new FakeConverseClient(awsError("AccessDeniedException", "Model use case details have not been submitted"));
    await expect(bedrock(client, "global.anthropic.claude-sonnet-4-6").complete(REQUEST, OPEN)).rejects.toThrow(
      new ExternalServiceError("bedrock global.anthropic.claude-sonnet-4-6: AccessDeniedException: Model use case details have not been submitted"),
    );
  });

  it.each([
    ["global.anthropic.claude-sonnet-4-6", "4.6"],
    ["in.anthropic.claude-haiku-4-5-20251001-v1:0", "20251001-v1:0"],
    [NOVA, "v1:0"],
    ["mystery", "unversioned"],
  ])("reads the version of %s as %s", (model, version) => {
    expect(bedrockVersion(model)).toBe(version);
  });
});

describe("OpenAiProvider", () => {
  function openAi(fetch: (url: string | URL | Request, init?: RequestInit) => Promise<Response>, timeoutMs = 1000) {
    const key = ApiKey.fromSecret(KEY_TEXT);
    if (key === null) {
      throw new Error("test key rejected");
    }
    const rejected: string[] = [];
    const rejectKey = () => rejected.push("key");
    const provider = new OpenAiProvider({ fetch: fetch as typeof globalThis.fetch, key, model: "gpt-4.1-mini", prices: new PriceTable(), timeoutMs, rejectKey });
    return { provider, rejected };
  }

  function replying(answer: Response, seen: RequestInit[] = []) {
    return openAi(async (_url, init) => {
      seen.push(init ?? {});
      return answer;
    });
  }

  it("posts Chat Completions with JSON mode, a data URL image and the bearer key", async () => {
    const seen: RequestInit[] = [];
    const response = await replying(chatReply('{"brand": "x"}'), seen).provider.complete(REQUEST, OPEN);
    const body = JSON.parse(String(seen[0]?.body)) as Record<string, unknown>;
    expect(new Headers(seen[0]?.headers).get("authorization")).toBe(`Bearer ${KEY_TEXT}`);
    expect(body).toMatchObject({ model: "gpt-4.1-mini", max_completion_tokens: 1024, temperature: 0, response_format: { type: "json_object" } });
    expect(body.messages).toEqual([
      { role: "system", content: REQUEST.systemText() },
      { role: "user", content: [{ type: "image_url", image_url: { url: "data:image/jpeg;base64,/9j/" } }, { type: "text", text: "What brand?" }] },
    ]);
    expect(response).toMatchObject({ text: '{"brand": "x"}', provider: "openai", model: "gpt-4.1-mini", version: "2025-04-14", inputTokens: 40, outputTokens: 2 });
  });

  it("reports only the error code of a 401, never the body, and rejects the key", async () => {
    const { provider, rejected } = replying(errorReply(401, "invalid_api_key"));
    await expect(provider.complete(REQUEST, OPEN)).rejects.toThrow(new ExternalServiceError("openai gpt-4.1-mini: HTTP 401 invalid_api_key"));
    expect(rejected).toEqual(["key"]);
  });

  it("keeps the key on other failures", async () => {
    const { provider, rejected } = replying(errorReply(429, "rate_limit_exceeded"));
    await expect(provider.complete(REQUEST, OPEN)).rejects.toThrow("HTTP 429 rate_limit_exceeded");
    expect(rejected).toEqual([]);
  });

  it("fails with ExternalServiceError when fetch never answers within the timeout", async () => {
    const { provider } = openAi(async (_url, init) => untilAborted(init?.signal ?? undefined), 20);
    await expect(provider.complete(REQUEST, OPEN)).rejects.toThrow(new ExternalServiceError("openai gpt-4.1-mini: TimeoutError: The operation was aborted due to timeout"));
  });

  it("stops a hanging fetch when the router's budget ends", async () => {
    const { provider } = openAi(async (_url, init) => untilAborted(init?.signal ?? undefined), 60_000);
    const budget = new AbortController();
    const call = provider.complete(REQUEST, budget.signal);
    budget.abort(new Error("budget spent"));
    await expect(call).rejects.toThrow(ExternalServiceError);
  });

  it("rejects a reply without choices", async () => {
    const reply = new Response(JSON.stringify({ model: "gpt-4.1-mini", choices: [] }), { status: 200 });
    await expect(replying(reply).provider.complete(REQUEST, OPEN)).rejects.toThrow("unexpected reply shape");
  });

  it.each([
    ["gpt-4.1-mini", "gpt-4.1-mini-2025-04-14", "2025-04-14"],
    ["gpt-4.1-mini", "gpt-4.1-mini", "unversioned"],
    ["gpt-4.1-mini", "other-model", "other-model"],
  ])("records model %s served as %s with version %s", (model, served, version) => {
    expect(openAiVersion(model, served)).toBe(version);
  });
});

describe("ApiKey", () => {
  it.each([null, "", "placeholder", "sk-short", "placeholder-0123456789abcdef", `Bearer ${KEY_TEXT}`, '{"a": "sk-1", "b": "sk-2"}'])(
    "treats %j as no key",
    (secret) => {
      expect(ApiKey.fromSecret(secret)).toBeNull();
    },
  );

  it("accepts a plain key or a JSON secret with a single value, and never prints it", () => {
    expect(ApiKey.fromSecret("sk-proj-AbC_123-xyz0123456789")?.bearer()).toBe("Bearer sk-proj-AbC_123-xyz0123456789");
    const key = ApiKey.fromSecret(`{"OPENAI_API_KEY": "${KEY_TEXT}"}`);
    expect(key?.bearer()).toBe(`Bearer ${KEY_TEXT}`);
    expect(`${String(key)} ${JSON.stringify({ key })}`).toBe('[redacted] {"key":"[redacted]"}');
  });
});

describe("SecretsManagerSecretReader", () => {
  function reader(answer: GetSecretValueCommandOutput | Error): SecretsManagerSecretReader {
    return new SecretsManagerSecretReader({
      send: async () => {
        if (answer instanceof Error) {
          throw answer;
        }
        return answer;
      },
    });
  }

  it("returns the secret string, or null when the secret does not exist", async () => {
    await expect(reader({ SecretString: "value", $metadata: {} }).read("id")).resolves.toBe("value");
    await expect(reader(awsError("ResourceNotFoundException", "gone")).read("id")).resolves.toBeNull();
  });

  it("raises ExternalServiceError for any other failure", async () => {
    await expect(reader(awsError("AccessDeniedException", "no")).read("id")).rejects.toThrow(ExternalServiceError);
  });
});
