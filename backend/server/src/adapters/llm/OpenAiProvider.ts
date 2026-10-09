import { z } from "zod";
import { ExternalServiceError } from "../../domain/errors.js";
import type { ApiKey } from "../../domain/llm/ApiKey.js";
import type { BlurredImage, LlmRequest } from "../../domain/llm/LlmRequest.js";
import { LlmResponse } from "../../domain/llm/LlmResponse.js";
import type { PriceTable } from "../../domain/llm/PriceTable.js";
import type { LlmProvider } from "../../ports/LlmProvider.js";
import { failureReason } from "./utils.js";

const CHAT_URL = "https://api.openai.com/v1/chat/completions";
// Only the error code leaves an error body: OpenAI's messages can echo part of the key.
const ERROR_CODE = /"code":\s*"([a-z0-9_]+)"/;
const ERROR_TYPE = /"type":\s*"([a-z0-9_]+)"/;

const ChatReply = z.object({
  model: z.string(),
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }).optional(),
});

type Reply = z.output<typeof ChatReply>;

export interface OpenAiTarget {
  readonly fetch: typeof fetch;
  readonly key: ApiKey;
  readonly model: string;
  readonly prices: PriceTable;
  readonly timeoutMs: number;
}

export class OpenAiProvider implements LlmProvider {
  readonly #target: OpenAiTarget;

  constructor(target: OpenAiTarget) {
    this.#target = target;
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const { model, prices } = this.#target;
    const started = performance.now();
    const reply = await this.#post(request);
    const inputTokens = reply.usage?.prompt_tokens ?? 0;
    const outputTokens = reply.usage?.completion_tokens ?? 0;
    return LlmResponse.of({
      text: reply.choices[0]?.message.content ?? "",
      provider: "openai",
      model,
      version: reply.model,
      latencyMs: Math.round(performance.now() - started),
      inputTokens,
      outputTokens,
      costUsd: prices.costUsd(model, inputTokens, outputTokens),
    });
  }

  async #post(request: LlmRequest): Promise<Reply> {
    const { fetch, key, model, timeoutMs } = this.#target;
    const name = `openai ${model}`;
    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: { authorization: key.bearer(), "content-type": "application/json" },
        body: JSON.stringify(OpenAiProvider.#body(request, model)),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        const code = OpenAiProvider.#errorCode(await response.text());
        throw new ExternalServiceError(`${name}: HTTP ${String(response.status)} ${code}`);
      }
      const reply = ChatReply.safeParse(await response.json());
      if (!reply.success) {
        throw new ExternalServiceError(`${name}: unexpected reply shape`);
      }
      return reply.data;
    } catch (error) {
      throw error instanceof ExternalServiceError
        ? error
        : new ExternalServiceError(`${name}: ${failureReason(error)}`, { cause: error });
    }
  }

  static #body(request: LlmRequest, model: string): object {
    const images = request.images.map((image) => ({ type: "image_url", image_url: { url: OpenAiProvider.#dataUrl(image) } }));
    const format = request.expectsJson() ? { response_format: { type: "json_object" } } : {};
    return {
      model,
      messages: [
        { role: "system", content: request.systemText() },
        { role: "user", content: [...images, { type: "text", text: request.userText }] },
      ],
      max_completion_tokens: request.maxTokens,
      temperature: request.temperature,
      ...format,
    };
  }

  static #errorCode(body: string): string {
    return ERROR_CODE.exec(body)?.[1] ?? ERROR_TYPE.exec(body)?.[1] ?? "no code";
  }

  static #dataUrl(image: BlurredImage): string {
    return `data:image/${image.format};base64,${Buffer.from(image.bytes).toString("base64")}`;
  }
}
