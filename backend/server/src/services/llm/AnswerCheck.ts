import type { LlmRequest } from "../../domain/llm/LlmRequest.js";
import type { LlmResponse } from "../../domain/llm/LlmResponse.js";

export type Rejection = "invalid_json" | "empty_answer";

// Decides whether one provider's answer is usable; `retries` is how often the same provider gets a reminder.
export interface AnswerCheck<J> {
  readonly retries: number;
  readonly rejection: Rejection;
  accept(response: LlmResponse): LlmResponse<J> | null;
  remind(request: LlmRequest): LlmRequest;
}
