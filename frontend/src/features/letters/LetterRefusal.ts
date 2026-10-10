import { ApiError } from '../../domain/ApiError';

export interface RefusalLine {
  /** Key under letter.errors.* in the i18n files. */
  readonly key: string;
  readonly params: Readonly<Record<string, number>>;
}

// contracts/README.md, POST /areas/{kind}/{id}/letters: "Not enough verified reports yet (3 of 10) ..." and
// "No-bin sites left out: ... (2 sites)." The api words these in English only, so the app keeps the numbers and its own words.
const COUNT = /\((\d+) of (\d+)\)/;
const NO_BIN_LEFT_OUT = /No-bin sites left out[^(]*\((\d+) sites?\)/;

/** A 409 not_verified as lines in the app's language, with the counts the api gave; empty for any other error. */
export class LetterRefusal {
  static lines(error: unknown): readonly RefusalLine[] {
    if (!(error instanceof ApiError) || error.code !== 'not_verified') return [];
    const lines: RefusalLine[] = [];
    const count = COUNT.exec(error.message);
    if (count) lines.push({ key: 'notEnough', params: { n: Number(count[1]), min: Number(count[2]) } });
    const noBin = NO_BIN_LEFT_OUT.exec(error.message);
    if (noBin) lines.push({ key: 'noBinLeftOut', params: { count: Number(noBin[1]) } });
    return lines;
  }
}
