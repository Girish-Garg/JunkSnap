import type { TFunction } from 'i18next';
import type { LetterCc, LetterDraft } from '../../domain/SiteActions';

/** The letter's own labels, in the letter's language rather than the app's. */
export class LetterText {
  readonly #t: TFunction;
  readonly #draft: LetterDraft;

  constructor(t: TFunction, draft: LetterDraft) {
    this.#t = t;
    this.#draft = draft;
  }

  label(key: string, params: Record<string, unknown> = {}): string {
    return this.term(`letter.${key}`, params);
  }

  /** Any app string, in the letter's language. */
  term(key: string, params: Record<string, unknown> = {}): string {
    return this.#t(key, { ...params, lng: this.#draft.language });
  }

  to(): string {
    return `${this.#draft.to.office}, ${this.#draft.to.body}`;
  }

  /** Offices and seats only, each "for attention". */
  cc(cc: LetterCc): string {
    return this.label(`cc.${cc.office}`, { seat: cc.seat.name });
  }

  verified(): string {
    return this.label('verified', { verified: this.#draft.verifier.verified, total: this.#draft.verifier.total });
  }

  /** The whole letter as plain text, for the clipboard. */
  plain(): string {
    const d = this.#draft;
    const citations = d.citations.map((c, i) => `${i + 1}. ${c.document}, ${c.clause}\n"${c.quote}"\n${this.label('hash')}: ${c.source_sha256}`);
    return [
      `${this.label('to')}: ${this.to()}`,
      ...d.cc.map((cc) => `${this.label('ccLabel')}: ${this.cc(cc)}`),
      `${this.label('subject')}: ${d.subject}`,
      '',
      d.body,
      '',
      this.label('citations'),
      ...citations,
      this.verified(),
    ].join('\n');
  }
}
