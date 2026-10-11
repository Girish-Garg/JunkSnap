import { EnvReader } from './EnvReader';
import type { EnvVars } from './EnvVar';
import { Vars } from './Vars';

/** How long copies of api answers are reused, and how often open screens ask again. */
export interface CacheSettings {
  /** An area listing younger than this is reused as is; the scores CronJob rewrites rows every 15 minutes. */
  readonly areaListTtlMs: number;
  readonly areaListEntries: number;
  /** A session left open across a deploy reads the new boundary index within this long. */
  readonly boundaryIndexTtlMs: number;
  /** GET /sites?bbox copies kept with their ETags (every read still asks; a 304 keeps the copy). */
  readonly siteTileEntries: number;
  /** GET /sites/{id} copies kept with their ETags. */
  readonly siteEntries: number;
  /** Activity's list token is fresh this long; after it, opening Activity syncs with GET /me/reports. */
  readonly activityTtlMs: number;
  /** While Activity is open, it syncs and refreshes open statuses this often. */
  readonly activitySyncMs: number;
  /** A report still being checked is read again this often. */
  readonly reportPollMs: number;
  /** A Scan still being checked is read again this often. */
  readonly scanPollMs: number;
  /** A site with a cleanup photo still being checked is read again this often. */
  readonly cleanupPollMs: number;
  /** The "What we checked" view reads its report again this often while the check runs. */
  readonly feedbackPollMs: number;
}

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const CACHE_VARS: EnvVars<CacheSettings> = {
  areaListTtlMs: Vars.ms('VITE_AREA_CACHE_TTL_MS', 5 * MINUTE_MS, DAY_MS),
  areaListEntries: Vars.count('VITE_AREA_CACHE_ENTRIES', 32, 1000),
  boundaryIndexTtlMs: Vars.ms('VITE_BOUNDARY_INDEX_TTL_MS', 10 * MINUTE_MS, DAY_MS),
  siteTileEntries: Vars.count('VITE_SITE_CACHE_TILES', 16, 1000),
  siteEntries: Vars.count('VITE_SITE_CACHE_SITES', 32, 1000),
  activityTtlMs: Vars.ms('VITE_ACTIVITY_TTL_MS', MINUTE_MS, DAY_MS),
  activitySyncMs: Vars.ms('VITE_ACTIVITY_SYNC_MS', 15_000),
  reportPollMs: Vars.ms('VITE_REPORT_POLL_MS', 4_000),
  scanPollMs: Vars.ms('VITE_SCAN_POLL_MS', 5_000),
  cleanupPollMs: Vars.ms('VITE_CLEANUP_POLL_MS', 5_000),
  feedbackPollMs: Vars.ms('VITE_FEEDBACK_POLL_MS', 5_000),
};

export const CACHE_DEFAULTS: CacheSettings = EnvReader.defaults(CACHE_VARS);
