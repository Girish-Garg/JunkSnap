import type { BrandJudge, JudgeVerdict } from "../../ports/brands/BrandJudge.js";

// Stand-in until the LLM layer's ProviderRouter lands: confirms nothing, so unclear cases are dropped.
export class AbstainingBrandJudge implements BrandJudge {
  async judge(): Promise<readonly JudgeVerdict[]> {
    return [];
  }
}
