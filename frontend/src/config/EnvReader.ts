import { BBox } from '../domain/BBox';
import type { EnvVar, EnvVars, GroupCheck } from './EnvVar';

/** The variables Vite baked into the build (import.meta.env), or a plain object in tests. */
export type EnvSource = Readonly<Record<string, unknown>>;

/** Where a bad value is reported; console.warn in the app. */
export type Warn = (message: string) => void;

/**
 * Reads VITE_ variables. Unset or blank takes the default; a value that does not parse also takes the default and
 * warns, so a typo in a build variable never stops the app from starting. A variable a stage may switch off (EnvVar
 * `off`, such as a link) is the exception: set blank, or to a value that does not parse, it is off.
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
    if (text === '') return this.#blank(variable);
    const value = variable.parse(text);
    return value === null ? this.#invalid(variable, text) : value;
  }

  // Blank is the same as unset, except that a variable a stage may switch off is off when it is set blank.
  #blank<T>(variable: EnvVar<T>): T {
    const set = typeof this.#env[variable.name] === 'string';
    return set && variable.off ? variable.off.value : variable.fallback;
  }

  #invalid<T>(variable: EnvVar<T>, text: string): T {
    const { off, fallback } = variable;
    const instead = off ? 'switching it off' : `using the default ${EnvReader.#show(fallback)}`;
    this.#warn(`[config] ${variable.name}="${text}" is not valid; ${instead}`);
    return off ? off.value : fallback;
  }

  /** Every variable of a group, as one frozen settings object; a combination a check refuses takes its defaults. */
  group<T>(vars: EnvVars<T>, checks: readonly GroupCheck<T>[] = []): T {
    const group = EnvReader.#build(vars, (variable) => this.read(variable));
    return checks.reduce((current, check) => this.#checked(current, vars, check), group);
  }

  /** A group's defaults, as if no variable were set. */
  static defaults<T>(vars: EnvVars<T>): T {
    return EnvReader.#build(vars, (variable) => variable.fallback);
  }

  #checked<T>(group: T, vars: EnvVars<T>, check: GroupCheck<T>): T {
    if (check.holds(group)) return group;
    const names = check.fields.map((field) => vars[field].name).join(' and ');
    this.#warn(`[config] ${check.says}; using the defaults for ${names}`);
    const defaults = Object.fromEntries(check.fields.map((field) => [field, vars[field].fallback]));
    return Object.freeze({ ...group, ...defaults });
  }

  static #build<T>(vars: EnvVars<T>, value: (variable: EnvVar<unknown>) => unknown): T {
    const entries = Object.entries<EnvVar<unknown>>(vars).map(([key, variable]) => [key, value(variable)]);
    return Object.freeze(Object.fromEntries(entries)) as T;
  }

  static #show(value: unknown): string {
    return value instanceof BBox ? value.toQuery() : String(value);
  }
}
