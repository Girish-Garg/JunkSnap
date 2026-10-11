import { z } from "zod";
import { ConfigError } from "../domain/errors.js";

export type Env = Readonly<Record<string, string | undefined>>;

export function parseEnv<S extends z.ZodType>(schema: S, env: Env): z.output<S> {
  const result = schema.safeParse(env);
  if (!result.success) {
    throw new ConfigError(z.prettifyError(result.error));
  }
  return result.data;
}

// Tunables: a blank or whitespace-only value means unset, so the default applies (z.coerce reads "" as 0).
// names limits this to those variables; without it every blank value is dropped.
export function parseTunables<S extends z.ZodType>(schema: S, env: Env, names?: readonly string[]): z.output<S> {
  const blank = (key: string, value: string | undefined) => value?.trim() === "" && (names === undefined || names.includes(key));
  return parseEnv(schema, Object.fromEntries(Object.entries(env).filter(([key, value]) => !blank(key, value))));
}

export function splitList(value: string): string[] {
  return value.split(",").map((part) => part.trim()).filter((part) => part !== "");
}
