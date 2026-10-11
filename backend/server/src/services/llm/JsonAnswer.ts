import type { AnswerSchema } from "../../domain/llm/AnswerSchema.js";
import type { LlmRequest } from "../../domain/llm/LlmRequest.js";
import type { LlmResponse } from "../../domain/llm/LlmResponse.js";
import type { AnswerCheck, Rejection } from "./AnswerCheck.js";

export class JsonAnswer<T> implements AnswerCheck<T> {
  readonly retries: number;
  readonly rejection: Rejection = "invalid_json";
  readonly #schema: AnswerSchema<T>;

  // retries: LLM_JSON_RETRIES.
  constructor(schema: AnswerSchema<T>, retries: number) {
    this.#schema = schema;
    this.retries = retries;
  }

  accept(response: LlmResponse): LlmResponse<T> | null {
    const value = JsonAnswer.#objectIn(response.text);
    if (value === undefined) {
      return null;
    }
    const parsed = this.#schema.safeParse(value);
    return parsed.success ? response.withJson(parsed.data) : null;
  }

  remind(request: LlmRequest): LlmRequest {
    const schema = request.jsonSchemaName ?? "requested";
    return request.withReminder(
      `Your previous answer was not valid JSON for the ${schema} schema. Reply with exactly one JSON object and nothing else.`,
    );
  }

  // Models sometimes wrap the object in prose or a code fence.
  static #objectIn(text: string): unknown {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end < start) {
      return undefined;
    }
    try {
      return JSON.parse(text.slice(start, end + 1)) as unknown;
    } catch (error) {
      if (error instanceof SyntaxError) {
        return undefined;
      }
      throw error;
    }
  }
}
