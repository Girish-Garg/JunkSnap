import type { AnswerSchema } from "../llm/AnswerSchema.js";

export interface NoteFlags {
  readonly toxic: boolean;
  readonly personal_data: boolean;
}

// The model's answer about one note: {"toxic": bool, "personal_data": bool} and nothing else.
export class NoteFlagsSchema implements AnswerSchema<NoteFlags> {
  safeParse(data: unknown): { readonly success: true; readonly data: NoteFlags } | { readonly success: false } {
    if (typeof data !== "object" || data === null) {
      return { success: false };
    }
    const { toxic, personal_data: personalData } = data as Record<string, unknown>;
    if (typeof toxic !== "boolean" || typeof personalData !== "boolean") {
      return { success: false };
    }
    return { success: true, data: { toxic, personal_data: personalData } };
  }
}
