import type { Rule } from "../../domain/letters/Rule.js";
import type { CcLine } from "../../domain/letters/types.js";
import type { Logger } from "../../ports/Logger.js";
import type { LetterBrief, WrittenLetter } from "../../ports/letters/LetterWriter.js";
import type { DraftVerifier } from "./DraftVerifier.js";

// Site and area letters share this: a brief that names its Cc lines, a model writer and a template.
export interface DraftBrief {
  readonly addressees: { readonly cc: readonly CcLine[] };
}

export interface BriefWriter<B> {
  write(brief: B): Promise<WrittenLetter>;
}

export interface BriefTemplate<B> {
  write(brief: B): WrittenLetter;
}

export interface DraftedProse extends WrittenLetter {
  readonly templateFallback: boolean;
}

export class ProseDrafter<B extends DraftBrief = LetterBrief> {
  readonly #writer: BriefWriter<B>;
  readonly #verifier: DraftVerifier;
  readonly #template: BriefTemplate<B>;
  readonly #logger: Logger;

  constructor(writer: BriefWriter<B>, verifier: DraftVerifier, template: BriefTemplate<B>, logger: Logger) {
    this.#writer = writer;
    this.#verifier = verifier;
    this.#template = template;
    this.#logger = logger;
  }

  async draft(brief: B, rules: readonly Rule[]): Promise<DraftedProse> {
    const written = await this.#attempt(brief);
    if (written !== null && this.#passes(written, rules, brief)) {
      return { ...written, templateFallback: false };
    }
    return { ...this.#template.write(brief), templateFallback: true };
  }

  async #attempt(brief: B): Promise<WrittenLetter | null> {
    try {
      return await this.#writer.write(brief);
    } catch (error) {
      this.#logger.warn({ error }, "letter writer failed; using the template letter");
      return null;
    }
  }

  #passes(written: WrittenLetter, rules: readonly Rule[], brief: B): boolean {
    const problem = this.#verifier.problem(written, rules, brief.addressees.cc);
    if (problem !== null) {
      const fields = { ...written.provenance, problem };
      this.#logger.warn(fields, "model draft failed the quote verifier; using the template letter");
    }
    return problem === null;
  }
}
