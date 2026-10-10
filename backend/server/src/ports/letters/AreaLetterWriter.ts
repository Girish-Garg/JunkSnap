import type { AreaLetterDraft } from "../../contracts/index.gen.js";
import type { AreaRef } from "../../domain/AreaKey.js";
import type { AreaIssue } from "../../domain/letters/AreaIssueSites.js";
import type { AreaAddressees, Citation, Language } from "../../domain/letters/types.js";
import type { WrittenLetter } from "./LetterWriter.js";

export interface AreaLetterBrief {
  readonly area: AreaRef;
  readonly issue: AreaIssue;
  readonly addressees: AreaAddressees;
  readonly citations: readonly Citation[];
  readonly language: Language;
  readonly evidence: AreaLetterDraft["evidence"];
}

export interface AreaLetterWriter {
  write(brief: AreaLetterBrief): Promise<WrittenLetter>;
}
