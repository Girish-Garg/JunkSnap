import { z } from "zod";
import type { ModerationRules } from "../domain/moderation/ModerationRules.js";
import { parseEnv, type Env } from "./utils.js";

const MEBIBYTE = 1024 * 1024;
const whole = (min: number, max: number, fallback: number) => z.coerce.number().int().min(min).max(max).default(fallback);

const ModerationRuleEnv = z.object({
  PHOTO_MAX_AGE_HOURS: whole(1, 720, 72),
  PHOTO_MAX_AHEAD_MINUTES: whole(0, 1_440, 5),
  DUPLICATE_RADIUS_M: whole(1, 1_000, 100),
  // Bits of a 64-bit perceptual hash.
  DUPLICATE_MAX_BITS: whole(0, 64, 8),
  CLEANUP_NEAR_SITE_M: whole(1, 1_000, 50),
  PHOTO_MAX_MB: whole(1, 50, 8),
  // About 2 km: absorbs the outline's 500 m simplification and GPS drift at coasts and borders.
  INDIA_BUFFER_DEG: z.coerce.number().min(0).max(1).default(0.02),
});

// The worker's photo checks: fresh timestamp, duplicate, near site, upload size and the India geofence.
export class ModerationRuleSettings implements ModerationRules {
  readonly maxAgeS: number;
  readonly maxAheadS: number;
  readonly duplicateRadiusM: number;
  readonly duplicateMaxBits: number;
  readonly nearSiteM: number;
  // A larger original is invalid_image.
  readonly maxUploadBytes: number;
  readonly indiaBufferDeg: number;

  private constructor(values: z.output<typeof ModerationRuleEnv>) {
    this.maxAgeS = values.PHOTO_MAX_AGE_HOURS * 3_600;
    this.maxAheadS = values.PHOTO_MAX_AHEAD_MINUTES * 60;
    this.duplicateRadiusM = values.DUPLICATE_RADIUS_M;
    this.duplicateMaxBits = values.DUPLICATE_MAX_BITS;
    this.nearSiteM = values.CLEANUP_NEAR_SITE_M;
    this.maxUploadBytes = values.PHOTO_MAX_MB * MEBIBYTE;
    this.indiaBufferDeg = values.INDIA_BUFFER_DEG;
    Object.freeze(this);
  }

  static fromEnv(env: Env): ModerationRuleSettings {
    return new ModerationRuleSettings(parseEnv(ModerationRuleEnv, env));
  }
}
