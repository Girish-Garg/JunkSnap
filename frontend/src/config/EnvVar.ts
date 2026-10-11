/** One VITE_ variable: its name, the value used when it is unset or not valid, and how its text is read. */
export interface EnvVar<T> {
  readonly name: string;
  readonly fallback: T;
  /** The value the text stands for, or null when the text is not a valid value. */
  readonly parse: (text: string) => T | null;
}

/** One VITE_ variable per field of a settings group. */
export type EnvVars<T> = { readonly [K in keyof T]: EnvVar<T[K]> };
