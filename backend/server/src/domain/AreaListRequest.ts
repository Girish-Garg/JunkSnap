import { AREA_KINDS, type AreaKind } from "./AreaKey.js";
import { ValidationError } from "./errors.js";

export const DEFAULT_AREA_LIMIT = 50;
export const MAX_AREA_LIMIT = 200;

const PLACE_ID = /^[a-z0-9-]{1,64}$/;
const WHOLE_NUMBER = /^[0-9]{1,6}$/;

// Raw query values as Fastify parses them; a repeated parameter arrives as an array.
export type QueryValue = string | readonly string[] | undefined;

export interface AreaListParams {
  readonly kind: string;
  readonly within: QueryValue;
  readonly limit: QueryValue;
}

// GET /areas/{kind}?within=&limit=: within is a district or local body id; a large limit is capped, not refused.
export class AreaListRequest {
  readonly kind: AreaKind;
  readonly within: string;
  readonly limit: number;

  private constructor(kind: AreaKind, within: string, limit: number) {
    this.kind = kind;
    this.within = within;
    this.limit = limit;
  }

  static parse(params: AreaListParams): AreaListRequest {
    const kind = AREA_KINDS.find((candidate) => candidate === params.kind);
    if (kind === undefined) {
      throw new ValidationError(`kind must be one of ${AREA_KINDS.join(", ")}`);
    }
    const within = params.within;
    if (typeof within !== "string" || !PLACE_ID.test(within)) {
      throw new ValidationError("within must be one district or local body id of 1 to 64 characters of a-z, 0-9 and -");
    }
    return new AreaListRequest(kind, within, AreaListRequest.#limit(params.limit));
  }

  static #limit(raw: QueryValue): number {
    if (raw === undefined) {
      return DEFAULT_AREA_LIMIT;
    }
    if (typeof raw !== "string" || !WHOLE_NUMBER.test(raw) || Number(raw) < 1) {
      throw new ValidationError(`limit must be a whole number from 1; above ${MAX_AREA_LIMIT} it is capped`);
    }
    return Math.min(Number(raw), MAX_AREA_LIMIT);
  }
}
