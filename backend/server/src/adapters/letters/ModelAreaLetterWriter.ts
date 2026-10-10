import { LlmRequest } from "../../domain/llm/LlmRequest.js";
import type { AreaLetterBrief, AreaLetterWriter } from "../../ports/letters/AreaLetterWriter.js";
import type { LetterModel } from "../../ports/letters/LetterModel.js";
import type { WrittenLetter } from "../../ports/letters/LetterWriter.js";
import { AreaLetterPrompt } from "./AreaLetterPrompt.js";
import { ProseAnswer } from "./ProseAnswer.js";

const MAX_TOKENS = 2000;
// Copying quotes word for word matters more than varied prose.
const TEMPERATURE = 0;

export class ModelAreaLetterWriter implements AreaLetterWriter {
  readonly #model: LetterModel;

  constructor(model: LetterModel) {
    this.#model = model;
  }

  async write(brief: AreaLetterBrief): Promise<WrittenLetter> {
    const prompt = new AreaLetterPrompt(brief);
    const request = new LlmRequest({
      task: "letters",
      system: prompt.system(),
      userText: prompt.user(),
      jsonSchemaName: "letter_prose",
      maxTokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    });
    const response = await this.#model.completeJson(request, new ProseAnswer());
    const { provider, model, version } = response;
    return { subject: response.json.subject, body: response.json.body, provenance: { provider, model, version } };
  }
}
