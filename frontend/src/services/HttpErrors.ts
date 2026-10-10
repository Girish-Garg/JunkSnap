import { ApiError } from '../domain/ApiError';
import { ErrorClassifier } from '../domain/ErrorClassifier';

interface ErrorBody {
  readonly error?: string;
  readonly message?: string;
}

/** Failed responses and fetches as ApiError with the contract's error code; status 0 means no response. */
export class HttpErrors {
  static async fromResponse(response: Response): Promise<ApiError> {
    const body = (await response.json().catch(() => ({}))) as ErrorBody;
    return new ApiError(response.status, body.error ?? 'server_error', body.message ?? response.statusText);
  }

  /** No response: code timeout when the request ran out of time, else network_error. */
  static network(what: string, cause: unknown): ApiError {
    return new ApiError(0, ErrorClassifier.isTimeout(cause) ? 'timeout' : 'network_error', `${what} failed: ${String(cause)}`);
  }
}
