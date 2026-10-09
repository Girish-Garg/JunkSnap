import type { ProviderName } from "./LlmTask.js";
import { ModelChoice } from "./ModelChoice.js";

export class TaskConfig {
  readonly provider: ProviderName;
  readonly model: string;
  readonly fallback: readonly ModelChoice[];

  constructor(provider: ProviderName, model: string, fallback: readonly ModelChoice[] = []) {
    this.provider = provider;
    this.model = model;
    this.fallback = Object.freeze([...fallback]);
  }

  choices(): readonly ModelChoice[] {
    return [new ModelChoice(this.provider, this.model), ...this.fallback];
  }
}
