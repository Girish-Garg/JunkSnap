import type { BlurredImage } from "../../domain/brands/BlurredImage.js";
import type { JudgeAnswer } from "../../domain/brands/JudgeAnswer.js";
import type { AnswerSchema } from "../../domain/llm/AnswerSchema.js";
import { LlmRequest } from "../../domain/llm/LlmRequest.js";
import type { BlurredImageStore } from "../../ports/brands/BlurredImageStore.js";
import type { BrandJudge, JudgeCase, JudgeVerdict } from "../../ports/brands/BrandJudge.js";
import type { ProviderRouter } from "../llm/ProviderRouter.js";

const SYSTEM = [
  "You check brand names printed on packaging in a photo of litter, for a civic waste report.",
  "For each case, look inside its region (fractions of image width and height) and decide whether one of its offered brands is printed there and readable.",
  "Read the letters. Never guess from colours, logos, shapes or the kind of product. If the name is not clearly readable, answer brand null.",
  "text_seen is the exact text you read, in its own script. confidence (0 to 1) is how sure you are that this text is printed there.",
  'Answer {"verdicts": [{"case_id": "...", "brand": "<one offered brand name>" or null, "confidence": 0.0, "text_seen": "..."}]}, one verdict per case.',
].join("\n");
const MAX_TOKENS = 600;

export interface LlmBrandJudgeParts {
  readonly router: Pick<ProviderRouter, "completeJson">;
  readonly images: BlurredImageStore;
  readonly schema: AnswerSchema<JudgeAnswer>;
}

// Task "brands" through the LLM layer's router (Bedrock first); the model sees only the blurred copy.
export class LlmBrandJudge implements BrandJudge {
  readonly #router: Pick<ProviderRouter, "completeJson">;
  readonly #images: BlurredImageStore;
  readonly #schema: AnswerSchema<JudgeAnswer>;

  constructor(parts: LlmBrandJudgeParts) {
    this.#router = parts.router;
    this.#images = parts.images;
    this.#schema = parts.schema;
  }

  async judge(image: BlurredImage, cases: readonly JudgeCase[]): Promise<readonly JudgeVerdict[]> {
    const bytes = await this.#images.jpegBytes(image);
    const request = new LlmRequest({
      task: "brands",
      system: SYSTEM,
      userText: cases.map((judgeCase) => LlmBrandJudge.#describe(judgeCase)).join("\n"),
      images: [{ bytes, format: "jpeg" }],
      jsonSchemaName: "brand_verdicts",
      maxTokens: MAX_TOKENS,
    });
    const response = await this.#router.completeJson(request, this.#schema);
    const source = { provider: response.provider, model: response.model, version: response.version };
    return response.json.verdicts.map((verdict) => ({
      caseId: verdict.case_id,
      brand: verdict.brand,
      confidence: verdict.confidence,
      textSeen: verdict.text_seen,
      source,
    }));
  }

  // Brand names only, never alias spellings, so the model must read the text rather than copy it.
  static #describe({ id, textSeen, box, options }: JudgeCase): string {
    const { left, top, width, height } = box.toContract();
    const read = textSeen === "" ? "OCR could not read the text here (it may be Devanagari)" : `OCR read ${JSON.stringify(textSeen)}`;
    const brands = options.map((entry) => entry.brand).join("; ");
    return `case ${id}: region left=${left} top=${top} width=${width} height=${height}; ${read}; offered brands: ${brands}`;
  }
}
