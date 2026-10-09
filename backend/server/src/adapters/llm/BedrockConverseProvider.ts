import { ConverseCommand, type ContentBlock, type ConverseCommandOutput } from "@aws-sdk/client-bedrock-runtime";
import { ExternalServiceError } from "../../domain/errors.js";
import type { LlmRequest } from "../../domain/llm/LlmRequest.js";
import { LlmResponse } from "../../domain/llm/LlmResponse.js";
import type { PriceTable } from "../../domain/llm/PriceTable.js";
import type { LlmProvider } from "../../ports/LlmProvider.js";
import { bedrockVersion, failureReason } from "./utils.js";

export interface ConverseClient {
  send(command: ConverseCommand, options?: { abortSignal?: AbortSignal }): Promise<ConverseCommandOutput>;
}

export interface BedrockTarget {
  readonly client: ConverseClient;
  readonly model: string;
  readonly prices: PriceTable;
  readonly timeoutMs: number;
}

// JSON comes from the prompt: Converse outputConfig structured output is not on every model.
export class BedrockConverseProvider implements LlmProvider {
  readonly #target: BedrockTarget;

  constructor(target: BedrockTarget) {
    this.#target = target;
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const { model, prices } = this.#target;
    const started = performance.now();
    const output = await this.#send(request);
    const inputTokens = output.usage?.inputTokens ?? 0;
    const outputTokens = output.usage?.outputTokens ?? 0;
    return LlmResponse.of({
      text: BedrockConverseProvider.#text(output),
      provider: "bedrock",
      model,
      version: bedrockVersion(model),
      latencyMs: Math.round(performance.now() - started),
      inputTokens,
      outputTokens,
      costUsd: prices.costUsd(model, inputTokens, outputTokens),
    });
  }

  async #send(request: LlmRequest): Promise<ConverseCommandOutput> {
    const { client, model, timeoutMs } = this.#target;
    const command = new ConverseCommand({
      modelId: model,
      system: [{ text: request.systemText() }],
      messages: [{ role: "user", content: BedrockConverseProvider.#content(request) }],
      inferenceConfig: { maxTokens: request.maxTokens, temperature: request.temperature },
    });
    try {
      return await client.send(command, { abortSignal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      throw new ExternalServiceError(`bedrock ${model}: ${failureReason(error)}`, { cause: error });
    }
  }

  static #content(request: LlmRequest): ContentBlock[] {
    const images = request.images.map(
      (image): ContentBlock => ({ image: { format: image.format, source: { bytes: image.bytes } } }),
    );
    return [...images, { text: request.userText }];
  }

  static #text(output: ConverseCommandOutput): string {
    const blocks = output.output?.message?.content ?? [];
    return blocks.map((block) => block.text ?? "").join("");
  }
}
