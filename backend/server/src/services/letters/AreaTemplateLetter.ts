import type { AreaLetterDraft } from "../../contracts/index.gen.js";
import { InternalDataError } from "../../domain/errors.js";
import type { CcLine, Language, Provenance, Recipient } from "../../domain/letters/types.js";
import type { AreaLetterBrief } from "../../ports/letters/AreaLetterWriter.js";
import type { WrittenLetter } from "../../ports/letters/LetterWriter.js";
import { TemplateLetter } from "./TemplateLetter.js";

const MAX_SUBJECT = 200;

export type AreaEvidence = AreaLetterDraft["evidence"];
export type WorstSite = AreaEvidence["worst_sites"][number];

export interface AreaWording {
  readonly language: Language;
  subject(brief: AreaLetterBrief): string;
  opening(to: readonly Recipient[]): string;
  facts(brief: AreaLetterBrief): string;
  worstSites(sites: readonly WorstSite[]): string;
  measured(evidence: AreaEvidence): string | null;
  rulesIntro(): string;
  request(brief: AreaLetterBrief): string;
  closing(cc: readonly CcLine[]): string;
}

export class AreaTemplateLetter {
  static readonly provenance: Provenance = { provider: "junksnap", model: "area-letter-template", version: "1" };
  readonly #wordings: ReadonlyMap<Language, AreaWording>;

  constructor(wordings: readonly AreaWording[]) {
    this.#wordings = new Map(wordings.map((wording) => [wording.language, wording]));
  }

  write(brief: AreaLetterBrief): WrittenLetter {
    const wording = this.#wording(brief.language);
    const quotes = brief.citations.map((citation) => TemplateLetter.citationBlock(citation)).join("\n\n");
    const parts = [
      wording.opening(brief.addressees.to),
      wording.facts(brief),
      wording.worstSites(brief.evidence.worst_sites),
      wording.measured(brief.evidence),
      `${wording.rulesIntro()}\n\n${quotes}`,
      wording.request(brief),
      wording.closing(brief.addressees.cc),
    ];
    const body = parts.filter((part) => part !== null).join("\n\n");
    const subject = wording.subject(brief);
    const fitted = subject.length <= MAX_SUBJECT ? subject : `${subject.slice(0, MAX_SUBJECT - 1)}…`;
    return { subject: fitted, body, provenance: AreaTemplateLetter.provenance };
  }

  #wording(language: Language): AreaWording {
    const wording = this.#wordings.get(language);
    if (wording === undefined) {
      throw new InternalDataError(`No area letter template for language ${language}`);
    }
    return wording;
  }
}
