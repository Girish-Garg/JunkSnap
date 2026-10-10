const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const STEPS: readonly { readonly unit: Intl.RelativeTimeFormatUnit; readonly ms: number; readonly below: number }[] = [
  { unit: 'minute', ms: MINUTE, below: HOUR },
  { unit: 'hour', ms: HOUR, below: DAY },
  { unit: 'day', ms: DAY, below: WEEK },
];

/** "now", "2 min ago", "3 hr ago", "yesterday", then a short date from a week on. Times ahead of the clock read "now". */
export class RelativeTime {
  readonly #relative: Intl.RelativeTimeFormat;
  readonly #date: Intl.DateTimeFormat;

  constructor(locale: string) {
    // Hindi's short units are abbreviations with a dot; the long ones read better.
    const style = locale.startsWith('hi') ? 'long' : 'short';
    this.#relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style });
    this.#date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  }

  format(isoTimestamp: string, nowMs: number): string {
    const at = Date.parse(isoTimestamp);
    const age = Math.max(0, nowMs - at);
    if (age < MINUTE) return this.#relative.format(0, 'second');
    const step = STEPS.find((each) => age < each.below);
    return step ? this.#relative.format(-Math.floor(age / step.ms), step.unit) : this.#date.format(new Date(at));
  }
}
