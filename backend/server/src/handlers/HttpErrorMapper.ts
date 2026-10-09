import { JunkSnapError, type ErrorCode } from "../domain/errors.js";

export interface ErrorBody {
  readonly error: ErrorCode;
  readonly message: string;
}

export interface ErrorResponse {
  readonly status: number;
  readonly body: ErrorBody;
}

const SERVER_ERROR_MESSAGE = "Something went wrong on our side. Please try again.";

// Turns anything thrown into the contract error shape; 5xx details stay in the logs.
export class HttpErrorMapper {
  map(error: unknown): ErrorResponse {
    if (error instanceof JunkSnapError) {
      return HttpErrorMapper.#response(error.status, error.code, error.message);
    }
    if (HttpErrorMapper.#isClientError(error)) {
      return HttpErrorMapper.#response(400, "bad_request", error.message);
    }
    return HttpErrorMapper.#response(500, "server_error", SERVER_ERROR_MESSAGE);
  }

  static #response(status: number, code: ErrorCode, message: string): ErrorResponse {
    const shown = status >= 500 ? SERVER_ERROR_MESSAGE : message;
    return { status, body: { error: code, message: shown } };
  }

  // Fastify's own 4xx errors: schema validation, bad JSON, wrong content type, body too large.
  static #isClientError(error: unknown): error is Error {
    if (!(error instanceof Error) || !("statusCode" in error)) {
      return false;
    }
    const status = error.statusCode;
    return typeof status === "number" && status >= 400 && status < 500;
  }
}
