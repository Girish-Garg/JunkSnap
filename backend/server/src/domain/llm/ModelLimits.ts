// One task's answer size and sampling temperature, as ModelLimitSettings reads them.
export interface ModelLimits {
  readonly maxTokens: number;
  readonly temperature: number;
}
