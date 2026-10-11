import { BBox } from '../domain/BBox';
import type { LonLat } from '../domain/Site';

export interface NumberRange {
  readonly min: number;
  readonly max: number;
  readonly integer?: boolean;
}

const NUMBERS = /^-?\d+(\.\d+)?$/;

/** Text to value for the VITE_ variables; each returns null for text that is not a valid value. */
export class EnvParsers {
  /** A plain decimal number inside the range; "1e3", "0x10", "12px" and "" are not numbers here. */
  static number(range: NumberRange): (text: string) => number | null {
    return (text) => {
      const value = EnvParsers.#decimal(text.replaceAll('_', ''));
      if (value === null || value < range.min || value > range.max) return null;
      return range.integer && !Number.isInteger(value) ? null : value;
    };
  }

  /** An absolute http or https URL. */
  static url(text: string): string | null {
    try {
      const { protocol } = new URL(text);
      return protocol === 'https:' || protocol === 'http:' ? text : null;
    } catch {
      return null;
    }
  }

  /** A folder under the app's base URL, such as "boundaries/"; never absolute and never climbing out with "..". */
  static folder(text: string): string | null {
    const trimmed = text.replace(/^\.?\/+/, '').replace(/\/+$/, '');
    if (!trimmed || trimmed.includes('..') || trimmed.includes(':') || trimmed.includes('\\')) return null;
    return `${trimmed}/`;
  }

  /** "lon,lat" in degrees. */
  static lonLat(text: string): LonLat | null {
    const numbers = EnvParsers.#list(text, 2);
    if (!numbers) return null;
    const [lon = 0, lat = 0] = numbers;
    return EnvParsers.#onEarth(lon, lat) ? [lon, lat] : null;
  }

  /** "minLon,minLat,maxLon,maxLat" in degrees, with the minimums below the maximums. */
  static box(text: string): BBox | null {
    const numbers = EnvParsers.#list(text, 4);
    const min = numbers && EnvParsers.lonLat(numbers.slice(0, 2).join(','));
    const max = numbers && EnvParsers.lonLat(numbers.slice(2).join(','));
    if (!min || !max || min[0] >= max[0] || min[1] >= max[1]) return null;
    return new BBox(min[0], min[1], max[0], max[1]);
  }

  static #decimal(text: string): number | null {
    return NUMBERS.test(text.trim()) ? Number(text) : null;
  }

  static #list(text: string, length: number): readonly number[] | null {
    const parts = text.split(',').map((part) => EnvParsers.#decimal(part));
    if (parts.length !== length || parts.some((part) => part === null)) return null;
    return parts as number[];
  }

  static #onEarth(lon: number, lat: number): boolean {
    return Math.abs(lon) <= 180 && Math.abs(lat) <= 90;
  }
}
