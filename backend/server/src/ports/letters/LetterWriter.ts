import type { LetterSite } from "../../domain/letters/LetterSite.js";
import type { Addressees, Citation, Language, Prose, Provenance } from "../../domain/letters/types.js";

export interface LetterBrief {
  readonly site: LetterSite;
  readonly addressees: Addressees;
  readonly citations: readonly Citation[];
  readonly language: Language;
}

export interface WrittenLetter extends Prose {
  readonly provenance: Provenance;
}

export interface LetterWriter {
  write(brief: LetterBrief): Promise<WrittenLetter>;
}
