import { validateVerificationResult, type VerificationResult } from "../contracts/index.gen.js";
import { ExternalServiceError, InternalDataError } from "../domain/errors.js";
import type { VerifyRequest } from "../domain/VerifyRequest.js";
import type { MlVerifyClient } from "../ports/MlVerifyClient.js";

const PATH = "/internal/verify";

export type FetchFunction = typeof fetch;

// POST to the ML service inside the cluster; the body names only the blurred key.
export class HttpMlVerifyClient implements MlVerifyClient {
  readonly #url: string;
  readonly #fetch: FetchFunction;
  readonly #timeoutMs: number;

  // timeoutMs: ML_VERIFY_TIMEOUT_MS.
  constructor(baseUrl: string, timeoutMs: number, fetchFunction: FetchFunction = fetch) {
    this.#url = `${baseUrl.replace(/\/+$/, "")}${PATH}`;
    this.#fetch = fetchFunction;
    this.#timeoutMs = timeoutMs;
  }

  async verify(request: VerifyRequest): Promise<VerificationResult> {
    const result = HttpMlVerifyClient.#validate(await this.#post(request));
    if (result.report_id !== request.report_id || result.purpose !== request.purpose) {
      throw new InternalDataError(`ML verify answered for ${result.report_id}, not ${request.report_id}`);
    }
    return result;
  }

  async #post(request: VerifyRequest): Promise<unknown> {
    const init = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(this.#timeoutMs),
    };
    let response: Response;
    try {
      response = await this.#fetch(this.#url, init);
    } catch (error) {
      throw new ExternalServiceError("ML verify call failed", { cause: error });
    }
    if (!response.ok) {
      throw new ExternalServiceError(`ML verify returned HTTP ${response.status}`);
    }
    return response.json().catch((error: unknown) => {
      throw new InternalDataError("ML verify returned a body that is not JSON", { cause: error });
    });
  }

  static #validate(body: unknown): VerificationResult {
    try {
      return validateVerificationResult(body);
    } catch (error) {
      throw new InternalDataError("ML verify returned a body outside verification_result", { cause: error });
    }
  }
}
