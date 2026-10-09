// Both locales group digits the Indian way (1,00,000).
const LOCALE_TAGS: Readonly<Record<string, string>> = { en: 'en-IN', hi: 'hi-IN' };

export class LocaleFormatter {
  readonly #numbers: Intl.NumberFormat;
  readonly #metres: Intl.NumberFormat;
  readonly #kilometres: Intl.NumberFormat;
  readonly #dates: Intl.DateTimeFormat;

  constructor(language: string) {
    const locale = LOCALE_TAGS[language] ?? 'en-IN';
    this.#numbers = new Intl.NumberFormat(locale);
    this.#metres = new Intl.NumberFormat(locale, { style: 'unit', unit: 'meter', maximumFractionDigits: 0 });
    this.#kilometres = new Intl.NumberFormat(locale, { style: 'unit', unit: 'kilometer', maximumFractionDigits: 1 });
    this.#dates = new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
    });
  }

  distance(metres: number): string {
    if (metres < 1000) return this.#metres.format(Math.round(metres / 10) * 10);
    return this.#kilometres.format(metres / 1000);
  }

  number(value: number): string {
    return this.#numbers.format(value);
  }

  dateTime(isoTimestamp: string): string {
    return this.#dates.format(new Date(isoTimestamp));
  }
}
