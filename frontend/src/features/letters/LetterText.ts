import type { TFunction } from 'i18next';
import type { LetterAddressee, LetterBase, LetterCc } from '../../domain/SiteActions';

/** The letter's own labels, in the letter's language rather than the app's. */
export class LetterText {
  readonly #t: TFunction;
  readonly #draft: LetterBase;

  constructor(t: TFunction, draft: LetterBase) {
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

  /** One line per office addressed. */
  to(): readonly string[] {
    const to = this.#draft.to;
    return (Array.isArray(to) ? to : [to]).map((addressee: LetterAddressee) => `${addressee.office}, ${addressee.body}`);
  }

  /** Offices and seats only, each "for attention". */
  cc(cc: LetterCc): string {
    return this.label(`cc.${cc.office}`, { seat: cc.seat.name });
  }

  verified(): string {
    return this.label('verified', { verified: this.#draft.verifier.verified, total: this.#draft.verifier.total });
  }

  /** The whole letter as plain text, for the clipboard; `link` adds the site or area page, with its photos and counts. */
  plain(link?: string): string {
    const d = this.#draft;
    const citations = d.citations.map((c, i) => `${i + 1}. ${c.document}, ${c.clause}\n"${c.quote}"\n${this.label('hash')}: ${c.source_sha256}`);
    return [
      `${this.label('to')}: ${this.to().join('; ')}`,
      ...d.cc.map((cc) => `${this.label('ccLabel')}: ${this.cc(cc)}`),
      `${this.label('subject')}: ${d.subject}`,
      '',
      d.body,
      '',
      this.label('citations'),
      ...citations,
      this.verified(),
      ...(link ? ['', `${this.label('link')}: ${link}`] : []),
    ].join('\n');
  }
}
