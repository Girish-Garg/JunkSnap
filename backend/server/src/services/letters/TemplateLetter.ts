import { InternalDataError } from "../../domain/errors.js";
import type { LetterSite } from "../../domain/letters/LetterSite.js";
import type { CcLine, Citation, Language, Provenance, Recipient } from "../../domain/letters/types.js";
import type { LetterBrief, WrittenLetter } from "../../ports/letters/LetterWriter.js";

const MAX_SUBJECT = 200;
const BARE_RULE_NUMBER = /^\d/;

export interface TemplateWording {
  readonly language: Language;
  subject(site: LetterSite): string;
  opening(to: Recipient): string;
  facts(site: LetterSite): string;
  rulesIntro(): string;
  request(site: LetterSite): string;
  closing(cc: readonly CcLine[]): string;
}

export class TemplateLetter {
  static readonly provenance: Provenance = { provider: "junksnap", model: "letter-template", version: "1" };
  readonly #wordings: ReadonlyMap<Language, TemplateWording>;

  constructor(wordings: readonly TemplateWording[]) {
    this.#wordings = new Map(wordings.map((wording) => [wording.language, wording]));
  }

  static citationBlock(citation: Citation): string {
    const clause = BARE_RULE_NUMBER.test(citation.clause) ? `rule ${citation.clause}` : citation.clause;
    return `${citation.document}, ${clause}:\n"${citation.quote}"`;
  }

  write(brief: LetterBrief): WrittenLetter {
    const wording = this.#wording(brief.language);
    const quotes = brief.citations.map((citation) => TemplateLetter.citationBlock(citation)).join("\n\n");
    const body = [
      wording.opening(brief.addressees.to),
      wording.facts(brief.site),
      `${wording.rulesIntro()}\n\n${quotes}`,
      wording.request(brief.site),
      wording.closing(brief.addressees.cc),
    ].join("\n\n");
    return { subject: TemplateLetter.#fit(wording.subject(brief.site)), body, provenance: TemplateLetter.provenance };
  }

  #wording(language: Language): TemplateWording {
    const wording = this.#wordings.get(language);
    if (wording === undefined) {
      throw new InternalDataError(`No letter template for language ${language}`);
    }
    return wording;
  }

  static #fit(subject: string): string {
    return subject.length <= MAX_SUBJECT ? subject : `${subject.slice(0, MAX_SUBJECT - 1)}…`;
  }
}
