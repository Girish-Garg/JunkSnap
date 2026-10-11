import { z } from "zod";
import type { PhotoFlagRules, SiteRules } from "../domain/sites/SiteRules.js";
import { parseEnv, type Env } from "./utils.js";

const people = (fallback: number, min = 1) => z.coerce.number().int().min(min).max(1_000).default(fallback);
const metres = (fallback: number) => z.coerce.number().int().min(1).max(50_000).default(fallback);

// The site rules in contracts/README.md; api, worker and scores read the same variables, so they always agree.
const SiteRuleEnv = z
  .object({
    REJECT_MARGIN: people(3),
    // The site contract's clearance.needed is at least 3.
    CLEANED_QUORUM: people(3, 3),
    CLEARED_MARGIN: people(3),
    VOTE_RADIUS_M: metres(1_000),
    SITE_TTL_DAYS: z.coerce.number().int().min(1).max(3_650).default(90),
    SITE_MERGE_RADIUS_M: metres(40),
    ZONE_MERGE_RADIUS_M: metres(500),
    TARGET_MAX_M: metres(500),
    MERGE_MIN_COSINE: z.coerce.number().gt(0).max(1).default(0.88),
    PHOTO_FLAG_WARN: people(3),
    PHOTO_FLAG_HIDE: people(8),
    PHOTO_FLAG_HIDE_EARLY: people(5),
    PHOTO_FLAG_SURPLUS: people(5),
    FLAG_RADIUS_M: metres(1_000),
  })
  .refine((values) => values.PHOTO_FLAG_WARN <= values.PHOTO_FLAG_HIDE && values.PHOTO_FLAG_HIDE_EARLY <= values.PHOTO_FLAG_HIDE, {
    message: "PHOTO_FLAG_WARN and PHOTO_FLAG_HIDE_EARLY must not exceed PHOTO_FLAG_HIDE",
  });

type SiteRuleValues = z.output<typeof SiteRuleEnv>;

export class SiteRuleSettings implements SiteRules {
  readonly rejectMargin: number;
  readonly cleanedQuorum: number;
  readonly clearedMargin: number;
  readonly voteRadiusM: number;
  readonly ttlDays: number;
  readonly siteMergeRadiusM: number;
  readonly zoneMergeRadiusM: number;
  readonly flags: PhotoFlagRules;
  // How far a long-range target may be from the reporter's fix (decision 20261011-0400-hem-long-range-target).
  readonly targetMaxM: number;
  // Cosine at or above which a long-range report's embedding matches a site's.
  readonly mergeMinCosine: number;

  private constructor(values: SiteRuleValues) {
    this.rejectMargin = values.REJECT_MARGIN;
    this.cleanedQuorum = values.CLEANED_QUORUM;
    this.clearedMargin = values.CLEARED_MARGIN;
    this.voteRadiusM = values.VOTE_RADIUS_M;
    this.ttlDays = values.SITE_TTL_DAYS;
    this.siteMergeRadiusM = values.SITE_MERGE_RADIUS_M;
    this.zoneMergeRadiusM = values.ZONE_MERGE_RADIUS_M;
    this.targetMaxM = values.TARGET_MAX_M;
    this.mergeMinCosine = values.MERGE_MIN_COSINE;
    this.flags = Object.freeze({
      warn: values.PHOTO_FLAG_WARN,
      hide: values.PHOTO_FLAG_HIDE,
      hideEarly: values.PHOTO_FLAG_HIDE_EARLY,
      surplus: values.PHOTO_FLAG_SURPLUS,
      radiusM: values.FLAG_RADIUS_M,
    });
    Object.freeze(this);
  }

  static fromEnv(env: Env): SiteRuleSettings {
    return new SiteRuleSettings(parseEnv(SiteRuleEnv, env));
  }
}
