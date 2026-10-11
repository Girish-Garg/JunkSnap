import { ExternalServiceError } from "../../domain/errors.js";
import type { LetterBrief, LetterWriter, WrittenLetter } from "../../ports/letters/LetterWriter.js";
import { DraftVerifier } from "./DraftVerifier.js";

// "verified" or सत्यापित as a word; unverified, verification, असत्यापित and सत्यापन do not match.
const VERIFIED_CLAIM = /\bverified\b|(?<![\p{L}\p{M}])सत्यापित(?![\p{L}\p{M}])/iu;

// Decision 20261011-1750: a model draft that calls an unverified site verified never ships; the drafter falls back to the template.
export class BackingClaimGuard implements LetterWriter {
  readonly #writer: LetterWriter;

  constructor(writer: LetterWriter) {
    this.#writer = writer;
  }

  async write(brief: LetterBrief): Promise<WrittenLetter> {
    const written = await this.#writer.write(brief);
    if (!brief.site.verified && BackingClaimGuard.claimsVerified(written)) {
      throw new ExternalServiceError("model draft calls an unverified site verified");
    }
    return written;
  }

  // Quoted rule text may say verified; only the letter's own prose is checked.
  static claimsVerified(written: WrittenLetter): boolean {
    const text = `${written.subject}\n${written.body}`;
    const prose = DraftVerifier.passages(text).reduce((rest, passage) => rest.replace(passage, " "), text);
    return VERIFIED_CLAIM.test(prose.normalize("NFC"));
  }
}
