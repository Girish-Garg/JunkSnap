import type { LlmTask } from "./LlmTask.js";

export type ImageFormat = "jpeg" | "png" | "webp" | "gif";

// Callers pass only blurred copies; originals never reach a model.
export interface BlurredImage {
  readonly bytes: Uint8Array;
  readonly format: ImageFormat;
}

export interface LlmRequestFields {
  readonly task: LlmTask;
  readonly system: string;
  readonly userText: string;
  readonly images?: readonly BlurredImage[];
  readonly jsonSchemaName?: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
}

const DEFAULT_MAX_TOKENS = 1024;

export class LlmRequest {
  readonly task: LlmTask;
  readonly system: string;
  readonly userText: string;
  readonly images: readonly BlurredImage[];
  readonly jsonSchemaName: string | undefined;
  readonly maxTokens: number;
  readonly temperature: number;

  constructor(fields: LlmRequestFields) {
    this.task = fields.task;
    this.system = fields.system;
    this.userText = fields.userText;
    this.images = Object.freeze([...(fields.images ?? [])]);
    this.jsonSchemaName = fields.jsonSchemaName;
    this.maxTokens = fields.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.temperature = fields.temperature ?? 0;
  }

  expectsJson(): boolean {
    return this.jsonSchemaName !== undefined;
  }

  // OpenAI's JSON mode rejects a request whose messages never say "JSON".
  systemText(): string {
    if (this.jsonSchemaName === undefined) {
      return this.system;
    }
    return `${this.system}\n\nReply with one JSON object for the ${this.jsonSchemaName} schema and nothing else.`;
  }

  withReminder(reminder: string): LlmRequest {
    return new LlmRequest({ ...this, userText: `${this.userText}\n\n${reminder}` });
  }
}
