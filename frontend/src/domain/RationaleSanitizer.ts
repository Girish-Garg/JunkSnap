/**
 * Makes the vision judge's short reason safe to show its reporter: no links, emails or phone
 * numbers or plates, a capped length, and nothing that could name a person or a company. Anything doubtful returns
 * null, and the view shows a generic line instead.
 */
export class RationaleSanitizer {
  static readonly MAX_LENGTH = 220;
  static readonly MIN_LENGTH = 12;

  static readonly #EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
  static readonly #URL = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|in|org|net|io|gov|co|info|app|ly|me)\b\S*/gi;
  // A run of digits, spaces, dots, brackets and dashes; it is a phone number when it holds 7 or more digits.
  static readonly #NUMBER_RUN = /\+?\(?\d[\d\s().-]{5,}\d/g;
  // Control characters (tabs, newlines, bells) become spaces.
  static readonly #CONTROL = /\p{Cc}/gu;
  // Format characters (zero-width and direction marks) are deleted, so "M<zero-width>r" reads "Mr" to the guards.
  static readonly #FORMAT = /\p{Cf}/gu;
  // Any word.word token followed by a path, like host.xyz/page, whatever its ending.
  static readonly #PATH_URL = /[a-z0-9-]*[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+\/\S*/gi;
  // Honorifics and naming phrases in English and Hindi: a sign the text names someone.
  static readonly #NAMING = /\b(?:mr|mrs|ms|miss|dr|shri|shree|sri|smt|kumari|sir|madam|named|called)\b\.?|\bname\s+is\b|श्री|श्रीमती|कुमारी|नाम/i;
  // A capital letter inside a sentence: a name, a brand or a place, all of which the generic line covers safely.
  static readonly #PROPER = /[^.!?\s]\s+["'(]?[A-Z]/;
  // Model reasons are English; any Devanagari may hold a name the guard cannot read.
  static readonly #DEVANAGARI = /\p{Script=Devanagari}/u;
  // An Indian number plate, for example RJ 19 CA 1234.
  static readonly #PLATE = /\b[a-z]{2}[\s-]?\d{1,2}[\s-]?[a-z]{0,3}[\s-]?\d{3,4}\b/i;

  static clean(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const text = RationaleSanitizer.#strip(raw);
    if (!RationaleSanitizer.#safe(text)) return null;
    return RationaleSanitizer.#cap(text);
  }

  static #strip(raw: string): string {
    return raw
      .replace(RationaleSanitizer.#FORMAT, '')
      .replace(RationaleSanitizer.#CONTROL, ' ')
      .replace(RationaleSanitizer.#EMAIL, ' ')
      .replace(RationaleSanitizer.#URL, ' ')
      .replace(RationaleSanitizer.#PATH_URL, ' ')
      .replace(RationaleSanitizer.#NUMBER_RUN, (run) => (run.replace(/\D/g, '').length >= 7 ? ' ' : run))
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .trim();
  }

  static #safe(text: string): boolean {
    if (text.length < RationaleSanitizer.MIN_LENGTH || !/\p{L}{3}/u.test(text)) return false;
    const guards = [RationaleSanitizer.#NAMING, RationaleSanitizer.#PROPER, RationaleSanitizer.#DEVANAGARI, RationaleSanitizer.#PLATE];
    return guards.every((guard) => !guard.test(text));
  }

  static #cap(text: string): string {
    if (text.length <= RationaleSanitizer.MAX_LENGTH) return text;
    const cut = text.slice(0, RationaleSanitizer.MAX_LENGTH - 1);
    const space = cut.lastIndexOf(' ');
    return `${(space > RationaleSanitizer.MAX_LENGTH / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:]+$/, '')}…`;
  }
}
