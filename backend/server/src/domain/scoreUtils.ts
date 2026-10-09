import type { InsightReason } from "./AreaInsights.js";

export const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 19_800_000;

export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function mean(values: readonly (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null);
  return known.length === 0 ? null : sum(known) / known.length;
}

export function median(values: readonly number[]): number | null {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle];
  const lower = sorted.length % 2 === 1 ? upper : sorted[middle - 1];
  return upper === undefined || lower === undefined ? null : (lower + upper) / 2;
}

export function percent(part: number, whole: number): number | null {
  return whole > 0 ? (part / whole) * 100 : null;
}

export function complement(pct: number | null): number | null {
  return pct === null ? null : 100 - pct;
}

export function rounded(value: number | null, digits: number): number | null {
  const scale = 10 ** digits;
  return value === null ? null : Math.round(value * scale) / scale;
}

// India has no daylight saving, so IST is a fixed +05:30.
export function istParts(epochMs: number): { day: string; hour: number; weekday: number } {
  const ist = new Date(epochMs + IST_OFFSET_MS);
  return { day: ist.toISOString().slice(0, 10), hour: ist.getUTCHours(), weekday: (ist.getUTCDay() + 6) % 7 };
}

export function isoSeconds(at: Date): string {
  return at.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function insightReason(enough: boolean, measured: boolean): InsightReason {
  if (!enough) {
    return "too_few_reports";
  }
  return measured ? null : "no_data";
}
