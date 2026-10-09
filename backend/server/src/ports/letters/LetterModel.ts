import type { AnswerSchema } from "../../domain/llm/AnswerSchema.js";
import type { LlmRequest } from "../../domain/llm/LlmRequest.js";
import type { LlmResponse } from "../../domain/llm/LlmResponse.js";

// The slice of the LLM ProviderRouter that letters use.
export interface LetterModel {
  completeJson<T>(request: LlmRequest, schema: AnswerSchema<T>): Promise<LlmResponse<T>>;
}
