import { LIMIT_DEFAULTS } from '../../config/ListLimits';

/** Office addresses for To and Cc: only ones that already exist in the letter draft or the ward data, never guessed. */
export interface MailRecipients {
  readonly to: readonly string[];
  readonly cc: readonly string[];
}

export interface LetterMail {
  readonly url: string;
  /** The letter did not fit: the link carries a short body, and the full letter goes to the clipboard first. */
  readonly long: boolean;
}

/** letter_draft, area_letter_draft and ward_scores carry no office email, so To and Cc stay empty for the resident to fill. */
export const NO_KNOWN_ADDRESSES: MailRecipients = { to: [], cc: [] };

// One plain address: anything that could add a recipient or a header (space, comma, ?, &, %) drops it.
const ADDRESS = /^[^\s@?&%,;:<>"#/]+@[^\s@?&%,;:<>"#/]+\.[a-z]{2,}$/i;

// RFC 6068: line breaks in a mailto: body are %0D%0A.
const encode = (text: string) => encodeURIComponent(text.replace(/\r?\n/g, '\r\n'));

/** A mailto: link with the subject and the letter, for the resident's own mail app. JunkSnap sends nothing. */
export class LetterMailto {
  readonly #to: string;
  readonly #cc: string;
  readonly #maxLength: number;

  /** Mail apps and Android intents cut long mailto: links; about 1,800 characters (limits.mailtoMaxLength) gets through all of them. */
  constructor(recipients: MailRecipients, maxLength: number = LIMIT_DEFAULTS.mailtoMaxLength) {
    this.#to = recipients.to.filter((address) => ADDRESS.test(address)).join(',');
    this.#cc = recipients.cc.filter((address) => ADDRESS.test(address)).join(',');
    this.#maxLength = maxLength;
  }

  /** The whole letter when the link stays short enough; else the subject and `short`, which says the letter is pasted. */
  compose(subject: string, letter: string, short: string): LetterMail {
    const full = this.#url(subject, letter);
    return full.length <= this.#maxLength ? { url: full, long: false } : { url: this.#url(subject, short), long: true };
  }

  #url(subject: string, body: string): string {
    const fields = [...(this.#cc ? [`cc=${this.#cc}`] : []), `subject=${encode(subject)}`, `body=${encode(body)}`];
    return `mailto:${this.#to}?${fields.join('&')}`;
  }
}
