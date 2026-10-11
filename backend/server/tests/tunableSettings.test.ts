import { describe, expect, it } from "vitest";
import { ConfigError } from "../src/domain/errors.js";
import { AreaListSettings } from "../src/settings/AreaListSettings.js";
import { NotesSettings } from "../src/settings/NotesSettings.js";
import { QueueSettings } from "../src/settings/QueueSettings.js";
import { ScoreSettings } from "../src/settings/ScoreSettings.js";
import { SiteRuleSettings } from "../src/settings/SiteRuleSettings.js";
import type { Env } from "../src/settings/utils.js";

// One variable: how its setting is read, its default, a value it accepts (and what that reads as) and values it refuses.
interface Tunable {
  readonly name: string;
  readonly read: (env: Env) => number;
  readonly fallback: number;
  readonly good: readonly [string, number];
  readonly bad: readonly string[];
}

const NOTE_TABLES = { NOTES_TABLE: "n", SITES_TABLE: "s", REPORTS_TABLE: "r", DEVICES_TABLE: "d", USERS_TABLE: "u" };
const COUNT_BAD = ["0", "-1", "2.5", "many"];
const rules = (env: Env) => SiteRuleSettings.fromEnv(env);

const RULE_TUNABLES: readonly Tunable[] = [
  { name: "REJECT_MARGIN", read: (env) => rules(env).rejectMargin, fallback: 3, good: ["4", 4], bad: COUNT_BAD },
  { name: "CLEANED_QUORUM", read: (env) => rules(env).cleanedQuorum, fallback: 3, good: ["5", 5], bad: ["2", ...COUNT_BAD] },
  { name: "CLEARED_MARGIN", read: (env) => rules(env).clearedMargin, fallback: 3, good: ["2", 2], bad: COUNT_BAD },
  { name: "VOTE_RADIUS_M", read: (env) => rules(env).voteRadiusM, fallback: 1_000, good: ["750", 750], bad: ["0", "-5", "60000"] },
  { name: "FLAG_RADIUS_M", read: (env) => rules(env).flags.radiusM, fallback: 1_000, good: ["2000", 2_000], bad: ["0", "x"] },
  { name: "SITE_TTL_DAYS", read: (env) => rules(env).ttlDays, fallback: 90, good: ["30", 30], bad: ["0", "1.5", "4000"] },
  { name: "SITE_MERGE_RADIUS_M", read: (env) => rules(env).siteMergeRadiusM, fallback: 40, good: ["25", 25], bad: ["0", "-40"] },
  { name: "ZONE_MERGE_RADIUS_M", read: (env) => rules(env).zoneMergeRadiusM, fallback: 500, good: ["300", 300], bad: ["0"] },
  { name: "TARGET_MAX_M", read: (env) => rules(env).targetMaxM, fallback: 500, good: ["300", 300], bad: ["0", "far"] },
  { name: "MERGE_MIN_COSINE", read: (env) => rules(env).mergeMinCosine, fallback: 0.88, good: ["0.9", 0.9], bad: ["0", "1.2", "-0.5"] },
  { name: "PHOTO_FLAG_WARN", read: (env) => rules(env).flags.warn, fallback: 3, good: ["2", 2], bad: COUNT_BAD },
  { name: "PHOTO_FLAG_HIDE", read: (env) => rules(env).flags.hide, fallback: 8, good: ["10", 10], bad: COUNT_BAD },
  { name: "PHOTO_FLAG_HIDE_EARLY", read: (env) => rules(env).flags.hideEarly, fallback: 5, good: ["4", 4], bad: COUNT_BAD },
  { name: "PHOTO_FLAG_SURPLUS", read: (env) => rules(env).flags.surplus, fallback: 5, good: ["6", 6], bad: COUNT_BAD },
  { name: "MIN_VERIFIED_REPORTS", read: (env) => ScoreSettings.fromEnv(env).minVerifiedReports, fallback: 10, good: ["5", 5], bad: COUNT_BAD },
  { name: "MIN_BIN_SERVICE_SITES", read: (env) => ScoreSettings.fromEnv(env).minBinServiceSites, fallback: 3, good: ["4", 4], bad: COUNT_BAD },
  { name: "AREA_LIST_DEFAULT_LIMIT", read: (env) => AreaListSettings.fromEnv(env).defaultLimit, fallback: 50, good: ["20", 20], bad: ["0", "201"] },
  { name: "AREA_LIST_MAX_LIMIT", read: (env) => AreaListSettings.fromEnv(env).maxLimit, fallback: 200, good: ["100", 100], bad: ["0", "201", "20"] },
  {
    name: "NOTE_ANALYSIS_INTERVAL_MINUTES",
    read: (env) => NotesSettings.fromEnv({ ...NOTE_TABLES, ...env }).analysisIntervalMs,
    fallback: 600_000,
    good: ["5", 300_000],
    bad: ["0", "1441", "soon"],
  },
  { name: "QUEUE_VISIBILITY_SECONDS", read: (env) => QueueSettings.fromEnv(env).visibilityMs, fallback: 300_000, good: ["600", 600_000], bad: ["0", "240"] },
  { name: "QUEUE_MAX_RECEIVE_COUNT", read: (env) => QueueSettings.fromEnv(env).maxReceiveCount, fallback: 3, good: ["5", 5], bad: COUNT_BAD },
  { name: "WORKER_MESSAGE_DEADLINE_MS", read: (env) => QueueSettings.fromEnv(env).messageDeadlineMs, fallback: 240_000, good: ["120000", 120_000], bad: ["10", "300000"] },
  { name: "WORKER_WAIT_SECONDS", read: (env) => QueueSettings.fromEnv(env).waitSeconds, fallback: 20, good: ["0", 0], bad: ["21", "-1"] },
  { name: "WORKER_BATCH_SIZE", read: (env) => QueueSettings.fromEnv(env).batchSize, fallback: 10, good: ["5", 5], bad: ["0", "11"] },
];

function describeTunables(title: string, tunables: readonly Tunable[]): void {
  describe(title, () => {
    describe.each(tunables)("$name", ({ name, read, fallback, good, bad }) => {
      it("defaults to today's value", () => {
        expect(read({})).toBe(fallback);
      });

      it("reads a valid value", () => {
        expect(read({ [name]: good[0] })).toBe(good[1]);
      });

      it.each(bad)("refuses %s", (value) => {
        expect(() => read({ [name]: value })).toThrow(ConfigError);
      });
    });
  });
}

describeTunables("site, score, area list, notes and queue variables", RULE_TUNABLES);

describe("settings that must agree with each other", () => {
  it("refuses photo flag thresholds above PHOTO_FLAG_HIDE", () => {
    expect(() => SiteRuleSettings.fromEnv({ PHOTO_FLAG_HIDE: "4" })).toThrow(/PHOTO_FLAG_HIDE/);
  });

  it("refuses a default area page larger than the cap", () => {
    expect(() => AreaListSettings.fromEnv({ AREA_LIST_DEFAULT_LIMIT: "100", AREA_LIST_MAX_LIMIT: "60" })).toThrow(ConfigError);
  });

  it("retries a site merge once more than a batch holds", () => {
    expect(QueueSettings.fromEnv({ WORKER_BATCH_SIZE: "4" }).mergeAttempts).toBe(5);
  });
});
