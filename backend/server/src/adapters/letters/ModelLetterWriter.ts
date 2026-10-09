import type { Prose } from "../../domain/letters/types.js";
import type { AnswerSchema } from "../../domain/llm/AnswerSchema.js";
import { LlmRequest } from "../../domain/llm/LlmRequest.js";
import type { LetterModel } from "../../ports/letters/LetterModel.js";
import type { LetterBrief, LetterWriter, WrittenLetter } from "../../ports/letters/LetterWriter.js";
import { LetterPrompt } from "./LetterPrompt.js";

const MAX_TOKENS = 1500;
// Copying quotes word for word matters more than varied prose.
const TEMPERATURE = 0;

type Parsed<T> = { readonly success: true; readonly data: T } | { readonly success: false };

class ProseAnswer implements AnswerSchema<Prose> {
  safeParse(data: unknown): Parsed<Prose> {
    if (typeof data !== "object" || data === null) {
      return { success: false };
    }
    const { subject, body } = data as Record<string, unknown>;
    return typeof subject === "string" && typeof body === "string"
      ? { success: true, data: { subject, body } }
      : { success: false };
  }
}

// Task `letters` through the provider router; the quote verifier decides afterwards whether the prose ships.
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
