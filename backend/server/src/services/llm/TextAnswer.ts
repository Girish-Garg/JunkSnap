import type { LlmRequest } from "../../domain/llm/LlmRequest.js";
import type { LlmResponse } from "../../domain/llm/LlmResponse.js";
import type { AnswerCheck, Rejection } from "./AnswerCheck.js";

// Any non-blank text is usable; a blank answer moves straight on to the next provider.
export class TextAnswer implements AnswerCheck<undefined> {
  readonly retries = 0;
  readonly rejection: Rejection = "empty_answer";

  accept(response: LlmResponse): LlmResponse | null {
    return response.text.trim() === "" ? null : response;
  }

  remind(request: LlmRequest): LlmRequest {
    return request;
  }
}
