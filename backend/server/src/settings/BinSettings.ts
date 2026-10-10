import { z } from "zod";
import { parseEnv, type Env } from "./utils.js";

const BinEnv = z.object({
  BIN_RADIUS_M: z.coerce.number().int().positive().default(3000),
  NO_BIN_MIN_REPORTERS: z.coerce.number().int().positive().default(5),
});

// Decision 20261010-1430: a no-bin site needs this many distinct reporters and no known bin within the radius.
export class BinSettings {
  readonly radiusM: number;
  readonly minReporters: number;

  private constructor(radiusM: number, minReporters: number) {
    this.radiusM = radiusM;
    this.minReporters = minReporters;
  }

  static fromEnv(env: Env): BinSettings {
    const values = parseEnv(BinEnv, env);
    return new BinSettings(values.BIN_RADIUS_M, values.NO_BIN_MIN_REPORTERS);
  }
}
