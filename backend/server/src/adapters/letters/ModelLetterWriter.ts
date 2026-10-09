import { LlmRequest } from "../../domain/llm/LlmRequest.js";
import type { LetterModel } from "../../ports/letters/LetterModel.js";
import type { LetterBrief, LetterWriter, WrittenLetter } from "../../ports/letters/LetterWriter.js";
import { LetterPrompt } from "./LetterPrompt.js";
import { ProseAnswer } from "./ProseAnswer.js";

const MAX_TOKENS = 1500;
// Copying quotes word for word matters more than varied prose.
const TEMPERATURE = 0;

export class ModelLetterWriter implements LetterWriter {
  readonly #model: LetterModel;

  constructor(model: LetterModel) {
    this.#model = model;
  }

  async write(brief: LetterBrief): Promise<WrittenLetter> {
    const prompt = new LetterPrompt(brief);
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
