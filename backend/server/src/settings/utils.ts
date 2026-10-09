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

export function splitList(value: string): string[] {
  return value.split(",").map((part) => part.trim()).filter((part) => part !== "");
}
