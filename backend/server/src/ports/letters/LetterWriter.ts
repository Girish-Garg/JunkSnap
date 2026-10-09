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

// A model writes the prose around code-picked citations; the quote verifier checks it afterwards.
export interface LetterWriter {
  write(brief: LetterBrief): Promise<WrittenLetter>;
}
