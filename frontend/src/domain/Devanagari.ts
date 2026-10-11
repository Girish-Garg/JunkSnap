type LetterKind = 'consonant' | 'vowel' | 'mark' | 'other';

/** One parsed letter: a consonant with its vowel sign (null for the inherent a), or a vowel, mark or other character. */
interface Letter {
  readonly kind: LetterKind;
  readonly text: string;
  readonly vowel: string | null;
  /** A consonant with a virama: it joins the next one and has no vowel. */
  readonly bare: boolean;
}

// A consonant may carry a nukta (ड़, ज़); the precomposed forms split into base and nukta under NFD.
const TOKEN = /[\u0915-\u0939]\u093C?|[\s\S]/gu;
const DEVANAGARI = /[\u0900-\u097F]/u;
const VIRAMA = '\u094D';
const LABIALS: ReadonlySet<string> = new Set(['p', 'ph', 'b', 'bh', 'm']);
// A final cluster ending in y, r, l or v keeps its a (mitra, kendra); others lose it (vard).
const CLUSTER_KEEPS: ReadonlySet<string> = new Set(['y', 'r', 'l', 'v']);

const CONSONANTS: Readonly<Record<string, string>> = {
  क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'n', च: 'ch', छ: 'chh', ज: 'j', झ: 'jh', ञ: 'n',
  ट: 't', ठ: 'th', ड: 'd', ढ: 'dh', ण: 'n', त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n',
  प: 'p', फ: 'ph', ब: 'b', भ: 'bh', म: 'm', य: 'y', र: 'r', ल: 'l', ळ: 'l', व: 'v',
  श: 'sh', ष: 'sh', स: 's', ह: 'h',
  'क\u093C': 'q', 'ख\u093C': 'kh', 'ग\u093C': 'g', 'ज\u093C': 'z', 'ड\u093C': 'r', 'ढ\u093C': 'rh', 'फ\u093C': 'f', 'य\u093C': 'y',
};
const VOWEL_SIGNS: Readonly<Record<string, string>> = {
  'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॅ': 'e', 'ॉ': 'o',
};
const VOWELS: Readonly<Record<string, string>> = {
  अ: 'a', आ: 'a', इ: 'i', ई: 'i', उ: 'u', ऊ: 'u', ऋ: 'ri', ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au', ऍ: 'e', ऑ: 'o',
};
// Anusvara and chandrabindu nasalise the vowel before them; visarga is a breath. Avagraha, dandas and joiners drop.
const MARKS: Readonly<Record<string, string>> = { 'ं': 'n', 'ँ': 'n', 'ः': 'h' };
const SILENT = /[\u093D\u0964\u0965\u200C\u200D]/gu;

/**
 * Devanagari to plain Latin letters, as a search aid for names the app holds only in Latin script (never shown).
 * Long vowels fold to short ones, a nukta letter takes its Urdu or flapped sound (ड़ r, ज़ z), anusvara is n (m before
 * p, b or m), digits become ASCII, and the inherent a is dropped where Hindi drops it: at the end of a word, and in
 * the middle when a vowel stands on each side (Ohala's rule, right to left). So सूरसागर reads sursagar and जोधपुर
 * jodhpur. It is an approximation: compounds such as गंगानगर come out as gangangar.
 */
export class Devanagari {
  /** Whether the text holds any Devanagari. */
  static has(text: string): boolean {
    return DEVANAGARI.test(text);
  }

  static toLatin(text: string): string {
    const letters = Devanagari.#letters(text.normalize('NFD').replace(SILENT, ''));
    const keeps = Devanagari.#schwas(letters);
    return letters.map((letter, i) => Devanagari.#sound(letter, keeps[i] === true, letters[i + 1])).join('');
  }

  static #letters(text: string): readonly Letter[] {
    const letters: Letter[] = [];
    for (const [token] of text.matchAll(TOKEN)) {
      const last = letters.at(-1);
      const joined = Devanagari.#open(last) ? Devanagari.#join(last, token) : null;
      if (joined) letters[letters.length - 1] = joined;
      else letters.push(Devanagari.#letter(token));
    }
    return letters;
  }

  /** The consonant with the vowel sign or virama that follows it; null when the token is neither. */
  static #join(consonant: Letter, token: string): Letter | null {
    const vowel = VOWEL_SIGNS[token];
    if (vowel !== undefined) return { ...consonant, vowel };
    return token === VIRAMA ? { ...consonant, bare: true } : null;
  }

  static #letter(token: string): Letter {
    const plain = { vowel: null, bare: false };
    // A nukta the table does not list (ऩ, ऱ) leaves the base consonant's sound.
    const consonant = CONSONANTS[token] ?? CONSONANTS[token.charAt(0)];
    if (consonant !== undefined) return { ...plain, kind: 'consonant', text: consonant };
    const mark = MARKS[token];
    if (mark !== undefined) return { ...plain, kind: 'mark', text: mark };
    // A vowel sign with no consonant to sit on sounds as its vowel.
    const vowel = VOWELS[token] ?? VOWEL_SIGNS[token];
    if (vowel !== undefined) return { ...plain, kind: 'vowel', text: vowel };
    return { ...plain, kind: 'other', text: Devanagari.#other(token) };
  }

  /** Devanagari digits become ASCII; any other Devanagari sign left over (a stray virama or nukta) is silent. */
  static #other(token: string): string {
    const digit = token.charCodeAt(0) - 0x0966;
    if (digit >= 0 && digit <= 9) return String(digit);
    return DEVANAGARI.test(token) ? '' : token.toLocaleLowerCase();
  }

  /** Which consonants keep their inherent a, decided from the end of the text backwards. */
  static #schwas(letters: readonly Letter[]): readonly boolean[] {
    const keeps = letters.map(() => false);
    for (let i = letters.length - 1; i >= 0; i -= 1) {
      const letter = letters[i];
      if (Devanagari.#open(letter)) keeps[i] = Devanagari.#keepsSchwa(letter, letters[i - 1], letters[i + 1], keeps[i + 1] === true);
    }
    return keeps;
  }

  /** Ohala's rule: the a goes at the end of a word, and between a vowel and a consonant said with a vowel. */
  static #keepsSchwa(letter: Letter, prev: Letter | undefined, next: Letter | undefined, nextKeeps: boolean): boolean {
    if (next === undefined || next.kind === 'other') return Devanagari.#clusterKeeps(letter, prev);
    // A vowel letter or a nasal mark right after it needs the a (गंगा ganga, कई kai).
    if (next.kind !== 'consonant') return true;
    return !(Devanagari.#vowelled(next, nextKeeps) && Devanagari.#vowelled(prev, true));
  }

  /** At the end of a word, a cluster ending in y, r, l or v keeps its a (mitra); any other final a goes. */
  static #clusterKeeps(letter: Letter, prev: Letter | undefined): boolean {
    return prev?.kind === 'consonant' && prev.bare && CLUSTER_KEEPS.has(letter.text);
  }

  /** A vowel letter, or a consonant said with a vowel: its own sign, or an inherent a that stays. */
  static #vowelled(letter: Letter | undefined, keepsA: boolean): boolean {
    if (letter?.kind === 'vowel') return true;
    return letter?.kind === 'consonant' && !letter.bare && (letter.vowel !== null || keepsA);
  }

  /** A consonant with its inherent a still undecided: no vowel sign and no virama. */
  static #open(letter: Letter | undefined): letter is Letter {
    return letter?.kind === 'consonant' && letter.vowel === null && !letter.bare;
  }

  static #sound(letter: Letter, keep: boolean, next: Letter | undefined): string {
    if (letter.kind === 'consonant') return letter.text + (letter.vowel ?? (keep ? 'a' : ''));
    return letter.kind === 'mark' ? Devanagari.#mark(letter.text, next) : letter.text;
  }

  /** A nasal mark before p, b or m is said m (सांभर sambhar). */
  static #mark(text: string, next: Letter | undefined): string {
    return text === 'n' && next?.kind === 'consonant' && LABIALS.has(next.text) ? 'm' : text;
  }
}
