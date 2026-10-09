import type { LlmRequest } from "../domain/llm/LlmRequest.js";
import type { LlmResponse } from "../domain/llm/LlmResponse.js";

// One model behind one API; a failed call throws ExternalServiceError, an unchecked answer is still returned.
export interface LlmProvider {
  complete(request: LlmRequest): Promise<LlmResponse>;
}
