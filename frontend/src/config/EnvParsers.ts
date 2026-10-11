import { BBox } from '../domain/BBox';
import type { LonLat } from '../domain/Site';

export interface NumberRange {
  readonly min: number;
  readonly max: number;
  readonly integer?: boolean;
}

// Digits with optional single _ between them (60_000), a sign and decimals; never a leading, trailing or double _,
// an exponent, hex or a unit.
const NUMBER = /^-?\d+(?:_\d+)*(?:\.\d+(?:_\d+)*)?$/;

/** Text to value for the VITE_ variables; each returns null for text that is not a valid value. */
export class EnvParsers {
  /** A plain decimal number inside the range; "1e3", "0x10", "12px", "6__0" and "" are not numbers here. */
  static number(range: NumberRange): (text: string) => number | null {
    return (text) => {
      const value = EnvParsers.#decimal(text);
      if (value === null || value < range.min || value > range.max) return null;
      return range.integer && !Number.isInteger(value) ? null : value;
    };
  }

  /** An absolute http or https URL. */
  static url(text: string): string | null {
    const protocol = EnvParsers.#protocol(text);
    return protocol === 'https:' || protocol === 'http:' ? text : null;
  }

  /** An absolute https URL: what a link out of the app may open. */
  static httpsUrl(text: string): string | null {
    return EnvParsers.#protocol(text) === 'https:' ? text : null;
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

  /** "minLon,minLat,maxLon,maxLat" in degrees, with the minimums below the maximums and each side at most maxSpanDeg. */
  static box(text: string, maxSpanDeg = Number.POSITIVE_INFINITY): BBox | null {
    const numbers = EnvParsers.#list(text, 4);
    const min = numbers && EnvParsers.lonLat(numbers.slice(0, 2).join(','));
    const max = numbers && EnvParsers.lonLat(numbers.slice(2).join(','));
    const box = min && max && EnvParsers.#ordered(min, max);
    return box && !box.isWiderThan(maxSpanDeg) ? box : null;
  }

  static #ordered([minLon, minLat]: LonLat, [maxLon, maxLat]: LonLat): BBox | null {
    return minLon < maxLon && minLat < maxLat ? new BBox(minLon, minLat, maxLon, maxLat) : null;
  }

  static #protocol(text: string): string | null {
    try {
      return new URL(text).protocol;
    } catch {
      return null;
    }
  }

  static #decimal(text: string): number | null {
    const trimmed = text.trim();
    return NUMBER.test(trimmed) ? Number(trimmed.replaceAll('_', '')) : null;
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
