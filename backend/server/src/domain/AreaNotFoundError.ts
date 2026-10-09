import { NotFoundError, type ErrorCode } from "./errors.js";

export class AreaNotFoundError extends NotFoundError {
  override readonly code: ErrorCode = "area_not_found";
}
