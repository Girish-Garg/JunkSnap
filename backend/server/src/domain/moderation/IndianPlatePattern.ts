// Registration state and union-territory codes, including the older OR, UA and DD and the newer TG.
const STATE_CODES: ReadonlySet<string> = new Set([
  "AN", "AP", "AR", "AS", "BR", "CG", "CH", "DD", "DL", "DN", "GA", "GJ", "HP", "HR", "JH", "JK", "KA", "KL", "LA", "LD",
  "MH", "ML", "MN", "MP", "MZ", "NL", "OD", "OR", "PB", "PY", "RJ", "SK", "TG", "TN", "TR", "TS", "UA", "UK", "UP", "WB",
]);
const STATE_SERIES = /^([A-Z]{2})[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/;
const BHARAT_SERIES = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/;
// Top line of a two-line bike or auto plate, for example MH12 or MH12AB.
const TOP_LINE = /^([A-Z]{2})[0-9]{1,2}[A-Z]{0,3}$/;
// Bottom line, for example AB1234 or 1234; OCR often reads the series letter D as 0, so letters may be digits.
const BOTTOM_LINE = /^[A-Z0-9]{0,3}[0-9]{4}$/;

export class IndianPlatePattern {
  normalise(text: string): string {
    return text.toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  isPlate(text: string): boolean {
    const plain = this.normalise(text);
    return BHARAT_SERIES.test(plain) || this.#hasStateCode(STATE_SERIES, plain);
  }

  isTopLine(text: string): boolean {
    return this.#hasStateCode(TOP_LINE, this.normalise(text));
  }

  isBottomLine(text: string): boolean {
    return BOTTOM_LINE.test(this.normalise(text));
  }

  #hasStateCode(pattern: RegExp, plain: string): boolean {
    const state = pattern.exec(plain)?.[1];
    return state !== undefined && STATE_CODES.has(state);
  }
}
