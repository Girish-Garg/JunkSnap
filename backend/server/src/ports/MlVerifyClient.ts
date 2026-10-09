import type { VerificationResult } from "../contracts/index.gen.js";
import type { VerifyRequest } from "../domain/VerifyRequest.js";

export interface MlVerifyClient {
  verify(request: VerifyRequest): Promise<VerificationResult>;
}
