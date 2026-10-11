import { BBox } from '../domain/BBox';
import type { EnvVar, EnvVars } from './EnvVar';

/** The variables Vite baked into the build (import.meta.env), or a plain object in tests. */
export type EnvSource = Readonly<Record<string, unknown>>;

/** Where a bad value is reported; console.warn in the app. */
export type Warn = (message: string) => void;

/**
 * Reads VITE_ variables. Unset or blank takes the default; a value that does not parse also takes the default and
 * warns, so a typo in a build variable never stops the app from starting.
 */
export class EnvReader {
  readonly #env: EnvSource;
  readonly #warn: Warn;

  constructor(env: EnvSource, warn: Warn) {
    this.#env = env;
    this.#warn = warn;
  }

  /** A text variable as it was set, trimmed; blank and unset are both "". */
  text(name: string): string {
    const raw = this.#env[name];
    return typeof raw === 'string' ? raw.trim() : '';
  }

  read<T>(variable: EnvVar<T>): T {
    const text = this.text(variable.name);
    if (text === '') return variable.fallback;
    const value = variable.parse(text);
    if (value !== null) return value;
    this.#warn(`[config] ${variable.name}="${text}" is not valid; using the default ${EnvReader.#show(variable.fallback)}`);
    return variable.fallback;
  }

  /** Every variable of a group, as one frozen settings object. */
  group<T>(vars: EnvVars<T>): T {
    return EnvReader.#build(vars, (variable) => this.read(variable));
  }

  /** A group's defaults, as if no variable were set. */
  static defaults<T>(vars: EnvVars<T>): T {
    return EnvReader.#build(vars, (variable) => variable.fallback);
  }

  static #build<T>(vars: EnvVars<T>, value: (variable: EnvVar<unknown>) => unknown): T {
    const entries = Object.entries<EnvVar<unknown>>(vars).map(([key, variable]) => [key, value(variable)]);
    return Object.freeze(Object.fromEntries(entries)) as T;
  }

  static #show(value: unknown): string {
    return value instanceof BBox ? value.toQuery() : String(value);
  }
}
