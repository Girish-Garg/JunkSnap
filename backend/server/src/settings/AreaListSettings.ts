import { z } from "zod";
import type { AreaListLimits } from "../domain/AreaListRequest.js";
import { parseTunables, type Env } from "./utils.js";

// The area_list contract caps a page at 200 areas, so neither may go above it.
const AreaListEnv = z
  .object({
    AREA_LIST_DEFAULT_LIMIT: z.coerce.number().int().min(1).max(200).default(50),
    AREA_LIST_MAX_LIMIT: z.coerce.number().int().min(1).max(200).default(200),
  })
  .refine((values) => values.AREA_LIST_DEFAULT_LIMIT <= values.AREA_LIST_MAX_LIMIT, {
    message: "AREA_LIST_DEFAULT_LIMIT must not exceed AREA_LIST_MAX_LIMIT",
  });

// GET /areas/{kind}?within=&limit=: the page size without limit, and the cap on a larger one.
export class AreaListSettings implements AreaListLimits {
  readonly defaultLimit: number;
  readonly maxLimit: number;

  private constructor(values: z.output<typeof AreaListEnv>) {
    this.defaultLimit = values.AREA_LIST_DEFAULT_LIMIT;
    this.maxLimit = values.AREA_LIST_MAX_LIMIT;
    Object.freeze(this);
  }

  static fromEnv(env: Env): AreaListSettings {
    return new AreaListSettings(parseTunables(AreaListEnv, env));
  }
}
