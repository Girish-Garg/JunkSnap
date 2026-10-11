import { LlmRequest } from "../../domain/llm/LlmRequest.js";
import type { ModelLimits } from "../../domain/llm/ModelLimits.js";
import type { AreaLetterBrief, AreaLetterWriter } from "../../ports/letters/AreaLetterWriter.js";
import type { LetterModel } from "../../ports/letters/LetterModel.js";
import type { WrittenLetter } from "../../ports/letters/LetterWriter.js";
import { AreaLetterPrompt } from "./AreaLetterPrompt.js";
import { ProseAnswer } from "./ProseAnswer.js";


export class ModelAreaLetterWriter implements AreaLetterWriter {
  readonly #model: LetterModel;
  readonly #limits: ModelLimits;

  // limits: LETTER_MAX_TOKENS (AREA_LETTER_MAX_TOKENS for area letters) and LETTER_TEMPERATURE.
  constructor(model: LetterModel, limits: ModelLimits) {
    this.#model = model;
    this.#limits = limits;
  }

  async write(brief: AreaLetterBrief): Promise<WrittenLetter> {
    const prompt = new AreaLetterPrompt(brief);
    const request = new LlmRequest({
      task: "letters",
      system: prompt.system(),
      userText: prompt.user(),
      jsonSchemaName: "letter_prose",
      maxTokens: this.#limits.maxTokens,
      temperature: this.#limits.temperature,
    });
    const response = await this.#model.completeJson(request, new ProseAnswer());
    const { provider, model, version } = response;
    return { subject: response.json.subject, body: response.json.body, provenance: { provider, model, version } };
  }
}
