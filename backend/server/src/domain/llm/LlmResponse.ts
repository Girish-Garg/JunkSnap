import type { ProviderName } from "./LlmTask.js";

export interface LlmResponseFields {
  readonly text: string;
  readonly provider: ProviderName;
  readonly model: string;
  readonly version: string;
  readonly latencyMs: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number | null;
}

// `json` holds the validated answer once the router has checked it; text answers keep it undefined.
export class LlmResponse<J = undefined> implements LlmResponseFields {
  readonly text: string;
  readonly provider: ProviderName;
  readonly model: string;
  readonly version: string;
  readonly latencyMs: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number | null;
  readonly json: J;

  private constructor(fields: LlmResponseFields, json: J) {
    this.text = fields.text;
    this.provider = fields.provider;
    this.model = fields.model;
    this.version = fields.version;
    this.latencyMs = fields.latencyMs;
    this.inputTokens = fields.inputTokens;
    this.outputTokens = fields.outputTokens;
    this.costUsd = fields.costUsd;
    this.json = json;
  }

  static of(fields: LlmResponseFields): LlmResponse {
    return new LlmResponse(fields, undefined);
  }

  withJson<T>(json: T): LlmResponse<T> {
    return new LlmResponse(this, json);
  }
}
