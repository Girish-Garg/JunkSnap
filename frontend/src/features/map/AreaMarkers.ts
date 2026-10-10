import type { AreaScores } from '../../domain/AreaScores';
import { AreaStanding } from '../../domain/AreaStanding';

/**
 * What an area's map marker shows: a language-neutral number beside a score or photo glyph (MapLibre cannot
 * shape Devanagari), and the words in a tooltip. value null shows the name alone.
 */
export interface AreaMarker {
  readonly value: string | null;
  readonly basis: 'score' | 'count' | null;
  /** Verified reports beside a shown score (a count marker's value is already its count). */
  readonly count: string | null;
  /** A shown score on pilot-city data carries the pilot flag. */
  readonly pilot: boolean;
  /** The same in words, for the hover tooltip. */
  readonly tooltip: string;
  /** 0 places first when markers collide: the worst shown score, then the most reports. */
  readonly rank: number;
}

export interface MarkerTexts {
  number(value: number): string;
  score(name: string, value: string, reports: string, pilot: boolean): string;
  reports(name: string, count: number, value: string): string;
  noReports(name: string): string;
}

/** Marker values by the fill's rule: the shown score with its count and pilot flag, else verified reports, never a withheld score. */
export class AreaMarkers {
  static of(rows: readonly AreaScores[], texts: MarkerTexts): ReadonlyMap<string, AreaMarker> {
    const standings = rows.map((row) => new AreaStanding(row)).sort(AreaMarkers.#worstFirst);
    return new Map(standings.map((standing, rank) => [standing.id, AreaMarkers.#marker(standing, texts, rank)]));
  }

  static #marker(standing: AreaStanding, texts: MarkerTexts, rank: number): AreaMarker {
    const { name, score, reports } = standing;
    if (score !== null) {
      const [value, count, pilot] = [texts.number(score), texts.number(reports), standing.row.pilot];
      return { value, basis: 'score', count, pilot, tooltip: texts.score(name, value, count, pilot), rank };
    }
    const none = { count: null, pilot: false, rank };
    if (reports > 0) {
      const value = texts.number(reports);
      return { ...none, value, basis: 'count', tooltip: texts.reports(name, reports, value) };
    }
    return { ...none, value: null, basis: null, tooltip: texts.noReports(name) };
  }

  static #worstFirst(a: AreaStanding, b: AreaStanding): number {
    const key = (s: AreaStanding) => s.score ?? Number.POSITIVE_INFINITY;
    return key(a) - key(b) || b.reports - a.reports || a.id.localeCompare(b.id);
  }
}
