import { Devanagari } from './Devanagari';

type Fold = (name: string) => string;

// Latin spellings of one Indian name vary (Soorsagar for सूरसागर, Lohawat for लोहावट, Jaipur for जयपुर), and Hindi
// drops the inherent a in places a Latin name keeps it (Ganganagar). So the key folds long vowels and doubled
// letters, w into v, y into i, ph into f, ksh into x, sh into s, ngh into nh (सिंह is Singh) and au into o, and leaves out every a after the first letter.
const FOLDS: readonly (readonly [RegExp, string])[] = [
  [/[^a-z0-9]/g, ''],
  [/ee/g, 'i'],
  [/oo/g, 'u'],
  [/au/g, 'o'],
  [/ph/g, 'f'],
  [/ksh/g, 'x'],
  [/sh/g, 's'],
  [/ngh/g, 'nh'],
  [/w/g, 'v'],
  [/y/g, 'i'],
  [/z/g, 'j'],
  [/q/g, 'k'],
  [/(?<=.)a/g, ''],
  [/(.)\1+/g, '$1'],
];
// A word-final nasal is spelt both ways in Latin names (Osian for ओसियां, Jhunjhunu for झुंझुनूं): the key leaves it out.
const FINAL_NASAL = /[\u0901\u0902](?=\s|$)/gu;

/**
 * Search text matched against the app's place names, which exist only in Latin script. Latin text matches as
 * before: the name holds it, case ignored. Devanagari text is transliterated (Devanagari.toLatin) and its spelling
 * key must sit in the name's key, so जोधपुर finds Jodhpur and सूरसागर Soorsagar. The transliteration is never shown.
 */
export class NameQuery {
  readonly #needle: string;
  readonly #fold: Fold;

  private constructor(needle: string, fold: Fold) {
    this.#needle = needle;
    this.#fold = fold;
  }

  static of(text: string): NameQuery {
    const trimmed = text.trim();
    if (!Devanagari.has(trimmed)) return new NameQuery(trimmed.toLocaleLowerCase(), (name) => name.toLocaleLowerCase());
    return new NameQuery(NameQuery.key(Devanagari.toLatin(trimmed.replace(FINAL_NASAL, ''))), NameQuery.key);
  }

  /** The spelling key of Latin text: lower-case ASCII letters and digits, folded as above. */
  static key(latin: string): string {
    const plain = latin.normalize('NFD').toLocaleLowerCase();
    return FOLDS.reduce((key, [pattern, replacement]) => key.replace(pattern, replacement), plain);
  }

  /** Nothing to search for: blank text, or only Devanagari signs with no sound of their own. */
  get empty(): boolean {
    return this.#needle.length === 0;
  }

  matches(name: string): boolean {
    return !this.empty && this.#fold(name).includes(this.#needle);
  }

  starts(name: string): boolean {
    return !this.empty && this.#fold(name).startsWith(this.#needle);
  }
}
