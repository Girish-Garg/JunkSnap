import { ExternalServiceError } from "../../domain/errors.js";
import type { LetterBrief, LetterWriter, WrittenLetter } from "../../ports/letters/LetterWriter.js";
import { DraftVerifier } from "./DraftVerifier.js";
import { VerifiedClaim } from "./VerifiedClaim.js";

// Decision 20261011-1750: a model draft that overstates the site's backing never ships; the drafter falls back to the template.
export class BackingClaimGuard implements LetterWriter {
  readonly #writer: LetterWriter;

  constructor(writer: LetterWriter) {
    this.#writer = writer;
  }

  async write(brief: LetterBrief): Promise<WrittenLetter> {
    const written = await this.#writer.write(brief);
    const problem = BackingClaimGuard.problem(written, brief.site.verified);
    if (problem !== null) {
      throw new ExternalServiceError(`model draft ${problem}`);
    }
    return written;
  }

  // Null when the draft is honest; "not yet verified" and its Hindi forms are honest for an unverified site.
  static problem(written: WrittenLetter, siteVerified: boolean): string | null {
    const claim = new VerifiedClaim(BackingClaimGuard.#ownProse(written));
    if (claim.undercounts()) {
      return "says verified by fewer people than verification needs";
    }
    return !siteVerified && claim.affirms() ? "calls an unverified site verified" : null;
  }

  // Quoted rule text may say verified; only the letter's own prose is read.
  static #ownProse(written: WrittenLetter): string {
    const text = `${written.subject}\n${written.body}`;
    return DraftVerifier.passages(text).reduce((rest, passage) => rest.replace(passage, " "), text);
  }
}
