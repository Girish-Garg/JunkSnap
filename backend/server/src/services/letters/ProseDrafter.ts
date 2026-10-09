import type { Rule } from "../../domain/letters/Rule.js";
import type { Logger } from "../../ports/Logger.js";
import type { LetterBrief, LetterWriter, WrittenLetter } from "../../ports/letters/LetterWriter.js";
import type { DraftVerifier } from "./DraftVerifier.js";
import type { TemplateLetter } from "./TemplateLetter.js";

export interface DraftedProse extends WrittenLetter {
  readonly templateFallback: boolean;
}

// The model's prose ships only if it passes the quote verifier; any failure falls back to the template.
export class ProseDrafter {
  readonly #writer: LetterWriter;
  readonly #verifier: DraftVerifier;
  readonly #template: TemplateLetter;
  readonly #logger: Logger;

  constructor(writer: LetterWriter, verifier: DraftVerifier, template: TemplateLetter, logger: Logger) {
    this.#writer = writer;
    this.#verifier = verifier;
    this.#template = template;
    this.#logger = logger;
  }

  async draft(brief: LetterBrief, rules: readonly Rule[]): Promise<DraftedProse> {
    const written = await this.#attempt(brief);
    if (written !== null && this.#passes(written, rules)) {
      return { ...written, templateFallback: false };
    }
    return { ...this.#template.write(brief), templateFallback: true };
  }

  async #attempt(brief: LetterBrief): Promise<WrittenLetter | null> {
    try {
      return await this.#writer.write(brief);
    } catch (error) {
      this.#logger.warn({ error }, "letter writer failed; using the template letter");
      return null;
    }
  }

  #passes(written: WrittenLetter, rules: readonly Rule[]): boolean {
    const problem = this.#verifier.problem(written, rules);
    if (problem !== null) {
      const fields = { ...written.provenance, problem };
      this.#logger.warn(fields, "model draft failed the quote verifier; using the template letter");
    }
    return problem === null;
  }
}
