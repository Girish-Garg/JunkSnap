import type { LlmRequest } from "../domain/llm/LlmRequest.js";
import type { LlmResponse } from "../domain/llm/LlmResponse.js";

// One model behind one API; a failed call throws ExternalServiceError, an unchecked answer is still returned.
export interface LlmProvider {
  // `budget` aborts when the router's time budget ends, so a call in flight stops too.
  complete(request: LlmRequest, budget: AbortSignal): Promise<LlmResponse>;
}
