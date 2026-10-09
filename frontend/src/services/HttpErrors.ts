import { ApiError } from '../domain/ApiError';

interface ErrorBody {
  readonly error?: string;
  readonly message?: string;
}

/** Failed responses and fetches as ApiError with the contract's error code; status 0 means no network. */
export class HttpErrors {
  static async fromResponse(response: Response): Promise<ApiError> {
    const body = (await response.json().catch(() => ({}))) as ErrorBody;
    return new ApiError(response.status, body.error ?? 'server_error', body.message ?? response.statusText);
  }

  static network(what: string, cause: unknown): ApiError {
    return new ApiError(0, 'network_error', `${what} failed: ${String(cause)}`);
  }
}
