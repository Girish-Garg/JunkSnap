import type { ProviderName } from "./LlmTask.js";

export class ModelChoice {
  readonly provider: ProviderName;
  readonly model: string;

  constructor(provider: ProviderName, model: string) {
    this.provider = provider;
    this.model = model;
  }
}
