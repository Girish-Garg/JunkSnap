import { EnvReader } from './EnvReader';
import type { EnvVars } from './EnvVar';
import { Vars } from './Vars';

/**
 * Distances and counts the api enforces, mirrored so the app can say "too far" or "not yet" before it asks, plus the
 * app's own margins. A mirrored value must change together with the server's variable of the same name.
 */
export interface SiteRules {
  /** Votes count within this many metres of the site (api VOTE_RADIUS_M). */
  readonly voteRadiusM: number;
  /** A photo report is taken within this many metres of the site (api FLAG_RADIUS_M). */
  readonly flagRadiusM: number;
  /** A cleanup photo is taken within this many metres of the site (the worker's near_site check). */
  readonly cleanupRadiusM: number;
  /** The map's fix is older and rougher than the one an action sends, so only this much past a radius blocks. */
  readonly distanceMarginM: number;
  /** How far a long-range pin reaches from the ground (decision 20261011-0400). */
  readonly targetGroundMaxM: number;
  /** How far a long-range pin reaches from a rooftop or upper floor (api TARGET_MAX_M, 422 target_too_far). */
  readonly targetMaxM: number;
  /** Room kept under targetMaxM so a photo added to a site never lands on the server's edge. */
  readonly targetMarginM: number;
  /** Closer than this a pin counts as "right here": GPS cannot tell the waste from the reporter. */
  readonly targetHereM: number;
  /** A report merges into a site within this many metres of its point (api SITE_MERGE_RADIUS_M). */
  readonly siteMergeRadiusM: number;
  /** A no-bin report says there is no dustbin within this many metres (api ZONE_RADIUS_M). */
  readonly zoneRadiusM: number;
  /** Verified reports an area needs before its scores show (api MIN_VERIFIED_REPORTS). */
  readonly minVerifiedReports: number;
}

const CITY_M = 50_000;

export const SITE_RULE_VARS: EnvVars<SiteRules> = {
  voteRadiusM: Vars.metres('VITE_VOTE_RADIUS_M', 1000, CITY_M),
  flagRadiusM: Vars.metres('VITE_FLAG_RADIUS_M', 1000, CITY_M),
  cleanupRadiusM: Vars.metres('VITE_CLEANUP_RADIUS_M', 50, CITY_M),
  distanceMarginM: Vars.number('VITE_DISTANCE_MARGIN_M', 100, { min: 0, max: CITY_M }),
  targetGroundMaxM: Vars.metres('VITE_TARGET_GROUND_MAX_M', 300, CITY_M),
  targetMaxM: Vars.metres('VITE_TARGET_MAX_M', 500, CITY_M),
  targetMarginM: Vars.number('VITE_TARGET_MARGIN_M', 10, { min: 0, max: CITY_M }),
  targetHereM: Vars.metres('VITE_TARGET_HERE_M', 10, CITY_M),
  siteMergeRadiusM: Vars.metres('VITE_SITE_MERGE_RADIUS_M', 40, CITY_M),
  zoneRadiusM: Vars.metres('VITE_ZONE_RADIUS_M', 1000, CITY_M),
  minVerifiedReports: Vars.count('VITE_MIN_VERIFIED_REPORTS', 10, 10_000),
};

export const SITE_RULE_DEFAULTS: SiteRules = EnvReader.defaults(SITE_RULE_VARS);
