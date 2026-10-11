import type { BBox } from '../domain/BBox';
import type { LonLat } from '../domain/Site';
import { EnvParsers, type NumberRange } from './EnvParsers';
import type { EnvVar } from './EnvVar';

const HOUR_MS = 3_600_000;
const EARTH_M = 20_000_000;

/** Declares the VITE_ variables of a settings group, each with its default and the values it accepts. */
export class Vars {
  static number(name: string, fallback: number, range: NumberRange): EnvVar<number> {
    return { name, fallback, parse: EnvParsers.number(range) };
  }

  /** A duration in milliseconds, from 1 ms up to `max` (an hour unless said). */
  static ms(name: string, fallback: number, max = HOUR_MS): EnvVar<number> {
    return Vars.number(name, fallback, { min: 1, max, integer: true });
  }

  /** A distance in metres. */
  static metres(name: string, fallback: number, max = EARTH_M): EnvVar<number> {
    return Vars.number(name, fallback, { min: 1, max });
  }

  /** A whole number of things, at least `min`. */
  static count(name: string, fallback: number, max: number, min = 1): EnvVar<number> {
    return Vars.number(name, fallback, { min, max, integer: true });
  }

  /** A share or a model score from 0 to 1. */
  static fraction(name: string, fallback: number): EnvVar<number> {
    return Vars.number(name, fallback, { min: 0, max: 1 });
  }

  static url(name: string, fallback: string): EnvVar<string> {
    return { name, fallback, parse: (text) => EnvParsers.url(text) };
  }

  static folder(name: string, fallback: string): EnvVar<string> {
    return { name, fallback, parse: (text) => EnvParsers.folder(text) };
  }

  static lonLat(name: string, fallback: LonLat): EnvVar<LonLat> {
    return { name, fallback, parse: (text) => EnvParsers.lonLat(text) };
  }

  static box(name: string, fallback: BBox): EnvVar<BBox> {
    return { name, fallback, parse: (text) => EnvParsers.box(text) };
  }
}
