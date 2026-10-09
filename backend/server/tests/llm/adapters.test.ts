import type { ConverseCommand, ConverseCommandOutput } from "@aws-sdk/client-bedrock-runtime";
import type { GetSecretValueCommandOutput } from "@aws-sdk/client-secrets-manager";
import { describe, expect, it } from "vitest";
import { BedrockConverseProvider, type ConverseClient } from "../../src/adapters/llm/BedrockConverseProvider.js";
import { OpenAiProvider } from "../../src/adapters/llm/OpenAiProvider.js";
import { bedrockVersion } from "../../src/adapters/llm/utils.js";
import { SecretsManagerSecretReader } from "../../src/adapters/SecretsManagerSecretReader.js";
import { ExternalServiceError } from "../../src/domain/errors.js";
import { ApiKey } from "../../src/domain/llm/ApiKey.js";
import { LlmRequest } from "../../src/domain/llm/LlmRequest.js";
import { PriceTable } from "../../src/domain/llm/PriceTable.js";
import { chatReply } from "./fakes.js";

const NOVA = "apac.amazon.nova-pro-v1:0";
const IMAGE = { bytes: new Uint8Array([255, 216, 255]), format: "jpeg" as const };
const REQUEST = new LlmRequest({ task: "brands", system: "Read labels.", userText: "What brand?", images: [IMAGE], jsonSchemaName: "brand" });
const KEY = ApiKey.fromSecret("sk-test-0123456789abcdefghijklmnop");

class FakeConverseClient implements ConverseClient {
  readonly commands: ConverseCommand[] = [];
  readonly #answer: ConverseCommandOutput | Error;

  constructor(answer: ConverseCommandOutput | Error) {
    this.#answer = answer;
  }

  async send(command: ConverseCommand): Promise<ConverseCommandOutput> {
    this.commands.push(command);
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

describe("BedrockConverseProvider", () => {
  it("sends system, image then text, and inference settings to Converse", async () => {
    const client = new FakeConverseClient(converseOutput(['{"brand":', ' "x"}']));
    const response = await new BedrockConverseProvider({ client, model: NOVA, prices: new PriceTable(), timeoutMs: 1000 }).complete(REQUEST);
    expect(client.commands[0]?.input).toEqual({
      modelId: NOVA,
      system: [{ text: expect.stringMatching(/^Read labels\.\n\nReply with one JSON object for the brand schema/) }],
      messages: [{ role: "user", content: [{ image: { format: "jpeg", source: { bytes: IMAGE.bytes } } }, { text: "What brand?" }] }],
      inferenceConfig: { maxTokens: 1024, temperature: 0 },
    });
    expect(response).toMatchObject({ text: '{"brand": "x"}', provider: "bedrock", version: "v1:0", inputTokens: 2294, outputTokens: 149, costUsd: 0.002312 });
  });

  it("turns an SDK error into ExternalServiceError with its name", async () => {
    const client = new FakeConverseClient(awsError("AccessDeniedException", "Model use case details have not been submitted"));
    const provider = new BedrockConverseProvider({ client, model: "global.anthropic.claude-sonnet-4-6", prices: new PriceTable(), timeoutMs: 1000 });
    await expect(provider.complete(REQUEST)).rejects.toThrow(
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
  function provider(answer: Response, seen: RequestInit[]): OpenAiProvider {
    const fetch = async (_url: string | URL | Request, init?: RequestInit) => {
      seen.push(init ?? {});
      return answer;
    };
    if (KEY === null) {
      throw new Error("test key rejected");
    }
    return new OpenAiProvider({ fetch: fetch as typeof globalThis.fetch, key: KEY, model: "gpt-4.1-mini", prices: new PriceTable(), timeoutMs: 1000 });
  }

  it("posts Chat Completions with JSON mode, a data URL image and the bearer key", async () => {
    const seen: RequestInit[] = [];
    const response = await provider(chatReply('{"brand": "x"}'), seen).complete(REQUEST);
    const body = JSON.parse(String(seen[0]?.body)) as Record<string, unknown>;
    expect(new Headers(seen[0]?.headers).get("authorization")).toBe("Bearer sk-test-0123456789abcdefghijklmnop");
    expect(body).toMatchObject({ model: "gpt-4.1-mini", max_completion_tokens: 1024, temperature: 0, response_format: { type: "json_object" } });
    expect(body.messages).toEqual([
      { role: "system", content: REQUEST.systemText() },
      { role: "user", content: [{ type: "image_url", image_url: { url: "data:image/jpeg;base64,/9j/" } }, { type: "text", text: "What brand?" }] },
    ]);
    expect(response).toMatchObject({ text: '{"brand": "x"}', provider: "openai", version: "gpt-4.1-mini-2025-04-14", inputTokens: 40, outputTokens: 2 });
  });

  it("reports only the error code of a failed call, never the body", async () => {
    const body = JSON.stringify({ error: { message: "Incorrect API key provided: sk-test-****mnop", type: "invalid_request_error", code: "invalid_api_key" } });
    const call = provider(new Response(body, { status: 401 }), []).complete(REQUEST);
    await expect(call).rejects.toThrow(new ExternalServiceError("openai gpt-4.1-mini: HTTP 401 invalid_api_key"));
  });

  it("rejects a reply without choices", async () => {
    const reply = new Response(JSON.stringify({ model: "gpt-4.1-mini", choices: [] }), { status: 200 });
    await expect(provider(reply, []).complete(REQUEST)).rejects.toThrow("unexpected reply shape");
  });
});

describe("ApiKey", () => {
  it.each([null, "", "short", "placeholder-0123456789abcdef", "TODO put the real key here", '{"a": "sk-1", "b": "sk-2"}'])(
    "treats %j as no key",
    (secret) => {
      expect(ApiKey.fromSecret(secret)).toBeNull();
    },
  );

  it("accepts a plain key or a JSON secret with a single value, and never prints it", () => {
    const key = ApiKey.fromSecret('{"OPENAI_API_KEY": "sk-test-0123456789abcdefghijklmnop"}');
    expect(key?.bearer()).toBe("Bearer sk-test-0123456789abcdefghijklmnop");
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
