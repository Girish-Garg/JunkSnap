import type { Prose } from "../../domain/letters/types.js";
import type { AnswerSchema } from "../../domain/llm/AnswerSchema.js";

type Parsed<T> = { readonly success: true; readonly data: T } | { readonly success: false };

export class ProseAnswer implements AnswerSchema<Prose> {
  safeParse(data: unknown): Parsed<Prose> {
    if (typeof data !== "object" || data === null) {
      return { success: false };
    }
    const { subject, body } = data as Record<string, unknown>;
    return typeof subject === "string" && typeof body === "string"
      ? { success: true, data: { subject, body } }
      : { success: false };
  }
}
