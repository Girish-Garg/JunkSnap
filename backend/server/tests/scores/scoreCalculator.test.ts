import { describe, expect, it } from "vitest";
import { validateWardScores } from "../../src/contracts/index.gen.js";
import type { AreaFactSheet } from "../../src/domain/AreaFactSheet.js";
import type { AreaSite } from "../../src/domain/AreaSite.js";
import { CitizenScore } from "../../src/services/CitizenScore.js";
import { Diagnoser } from "../../src/services/Diagnoser.js";
import { ScoreCalculator } from "../../src/services/ScoreCalculator.js";
import { binned, NO_FACTS, NOW, site, WARD } from "./siteBuilder.js";

const calculator = ScoreCalculator.standard();

function calculate(sites: readonly AreaSite[], facts: AreaFactSheet = NO_FACTS) {
  return calculator.calculate({ area: WARD, sites, facts, now: NOW });
}

// 10 verified reports over 4 verified sites; nearest bins 300, 300, 3600 and 900 m when measured.
function workedExample(measured = true): AreaSite[] {
  const bin = (distance: number) => (measured ? binned(distance) : null);
  return [
    site({ verifiedCount: 4, firstReportedAt: "2026-10-01T00:00:00Z", cleanedAt: "2026-10-03T00:00:00Z", status: "cleaned", insights: bin(300) }),
    site({ verifiedCount: 3, context: "other", firstReportedAt: "2026-10-05T00:00:00Z", cleanedAt: "2026-10-06T00:00:00Z", status: "reopened", insights: bin(300) }),
    site({ verifiedCount: 2, reportType: "no_bin", context: "no_bin", firstReportedAt: "2026-10-15T00:00:00Z", insights: bin(3600) }),
    site({ verifiedCount: 1, context: "roadside", firstReportedAt: "2026-10-18T00:00:00Z", insights: bin(900) }),
  ];
}

const FULL_FACTS: AreaFactSheet = { areaKm2: 2, placesMapped: true };

describe("ScoreCalculator guardrail", () => {
  it("withholds every score, metric and diagnosis at 9 verified reports but keeps the counts", () => {
    const row = calculate([site({ verifiedCount: 5 }), site({ verifiedCount: 4, reportType: "no_bin", context: "no_pickup" })]);
    expect(row.counts).toEqual({ verified_reports: 9, no_bin_reports: 4, sites: 2, open_sites: 2, cleaned_sites: 0, reopened_sites: 0, sites_without_bin_within_3km: 0 });
    for (const score of Object.values(row.scores)) {
      expect(score).toEqual({ value: null, reason: "too_few_reports" });
    }
    expect(Object.values(row.metrics).every((metric) => metric === null)).toBe(true);
    expect(row.diagnosis).toEqual([]);
    expect(row.min_verified_reports).toBe(10);
  });

  it("scores at exactly 10 verified reports", () => {
    const row = calculate([site({ verifiedCount: 6 }), site({ verifiedCount: 4 })]);
    expect(row.counts.verified_reports).toBe(10);
    expect(row.scores.city.reason).toBeNull();
    expect(row.scores.city.value).toEqual(expect.any(Number));
  });

  it("never counts rejected sites, and counts only verified reports on verified sites", () => {
    const row = calculate([
      site({ verifiedCount: 3, status: "cleaned", cleanedAt: "2026-10-11T00:00:00Z" }),
      site({ verifiedCount: 0, verification: "unverified", status: "reopened" }),
      site({ verifiedCount: 7, verification: "rejected" }),
    ]);
    expect(row.counts).toEqual({ verified_reports: 3, no_bin_reports: 0, sites: 2, open_sites: 0, cleaned_sites: 1, reopened_sites: 1, sites_without_bin_within_3km: 0 });
  });
});

describe("ScoreCalculator window, pilot and version", () => {
  it("starts the data window at the earliest real report and ends it at the run", () => {
    const row = calculate([
      site({ firstReportedAt: "2026-10-09T03:40:00Z" }),
      site({ firstReportedAt: "2026-10-01T00:00:00Z", verification: "rejected" }),
      site({ firstReportedAt: "2026-10-08T05:00:00Z", verification: "unverified" }),
    ]);
    expect(row.data_window).toEqual({ from: "2026-10-08T05:00:00Z", to: "2026-10-20T00:00:00Z" });
    expect(row.computed_at).toBe("2026-10-20T00:00:00Z");
    expect(row.formula_version).toBe("scores-v3");
  });

  it("flags the area as pilot when any of its sites is", () => {
    expect(calculate([site({ pilot: false }), site({ pilot: false })]).pilot).toBe(false);
    expect(calculate([site({ pilot: false }), site({ pilot: true, verification: "rejected" })]).pilot).toBe(true);
  });

  it("validates against the ward_scores contract, insights included", () => {
    expect(() => validateWardScores(calculate(workedExample(), FULL_FACTS))).not.toThrow();
    expect(() => validateWardScores(calculate([site()]))).not.toThrow();
  });
});

describe("ScoreCalculator scores-v3 formulas", () => {
  it("computes the city score from clearing speed, 7-day clearing, re-dumping and no-bin response", () => {
    const row = calculate(workedExample());
    expect(row.metrics).toMatchObject({
      median_days_to_clear: 2,
      cleared_within_7_days_pct: 100,
      redumped_pct: 50,
      no_bin_response_pct: 0,
    });
    // mean(100 - 10 x 2, 100, 100 - 50, 0) = 57.5
    expect(row.scores.city).toEqual({ value: 58, reason: null });
  });

  it("counts overflowing or broken bins under city response as bins serviced", () => {
    const overflowing = { reportType: "overflowing_bin", context: "overflowing" } as const;
    const row = calculate([
      ...workedExample(),
      site({ ...overflowing, verifiedCount: 2, firstReportedAt: "2026-10-17T00:00:00Z", cleanedAt: "2026-10-18T00:00:00Z", status: "cleaned" }),
      site({ ...overflowing, context: "damaged", verifiedCount: 1, firstReportedAt: "2026-10-18T00:00:00Z" }),
      site({ ...overflowing, verifiedCount: 1, firstReportedAt: "2026-10-19T00:00:00Z" }),
    ]);
    expect(row.metrics.bin_service_pct).toBe(33.3);
    expect(row.metrics.no_bin_response_pct).toBe(0);
    expect(row.diagnosis).toContain("city_response");
    expect(() => validateWardScores(row)).not.toThrow();
  });

  it("leaves bin service null without overflowing_bin sites", () => {
    expect(calculate(workedExample()).metrics.bin_service_pct).toBeNull();
  });

  it("measures bin access from the sites' nearest known bins, never from no_bin report counts", () => {
    const row = calculate(workedExample(), FULL_FACTS);
    expect(row.metrics).toMatchObject({
      new_dumps_per_km2_month: 2.4,
      share_vacant_plot_drain_roadside_pct: 62.5,
      median_distance_to_disposal_m: 600,
      no_bin_within_3km_pct: 25,
    });
    expect(row.counts.sites_without_bin_within_3km).toBe(1);
    // mean(100 - 25, 100 - 600 / 30) = 77.5
    expect(row.scores.bin_access).toEqual({ value: 78, reason: null });
    // raw = mean(100 - 5 x 3 / 2 / (19 / 30), 100 - 62.5, 100 - 50) = 58.55; adjusted by (100 - 77.5) / 200
    expect(row.scores.citizen).toEqual({ value: 63, reason: null });
    expect(row.diagnosis).toEqual(["repeat_spot"]);
  });

  it("gives no_data for citizen without km² and for bin access when no site was measured", () => {
    const row = calculate(workedExample(false));
    expect(row.scores.citizen).toEqual({ value: null, reason: "no_data" });
    expect(row.scores.bin_access).toEqual({ value: null, reason: "no_data" });
    expect(row.metrics.new_dumps_per_km2_month).toBeNull();
    expect(row.metrics.median_distance_to_disposal_m).toBeNull();
    expect(row.metrics.share_vacant_plot_drain_roadside_pct).toBe(62.5);
  });

  it("leaves citizen unadjusted when only bin access is missing", () => {
    const row = calculate(workedExample(false), FULL_FACTS);
    expect(row.scores.citizen).toEqual({ value: 59, reason: null });
  });

  it("only judges 7-day clearing on sites reported 7 or more days before the run", () => {
    const recent = [site({ verifiedCount: 10, firstReportedAt: "2026-10-15T00:00:00Z" })];
    expect(calculate(recent).metrics.cleared_within_7_days_pct).toBeNull();
    const old = [site({ verifiedCount: 10, firstReportedAt: "2026-10-01T00:00:00Z", status: "cleaned", cleanedAt: "2026-10-09T00:00:00Z" })];
    expect(calculate(old).metrics).toMatchObject({ cleared_within_7_days_pct: 0, median_days_to_clear: 8 });
  });

  it("leaves unmeasured sites out of the no-bin share and counts a site with no bin in the searched area", () => {
    const sites = [
      site({ verifiedCount: 4, insights: binned(1000) }),
      site({ verifiedCount: 4, insights: binned(null) }),
      site({ verifiedCount: 4 }),
      site({ verifiedCount: 4, verification: "unverified", insights: binned(null) }),
    ];
    const row = calculate(sites);
    expect(row.metrics).toMatchObject({ no_bin_within_3km_pct: 50, median_distance_to_disposal_m: 1000 });
    expect(row.counts.sites_without_bin_within_3km).toBe(1);
  });
});

describe("CitizenScore.adjust", () => {
  const citizen = new CitizenScore();

  it.each([
    [40, 20, 64],
    [40, 100, 40],
    [80, 0, 90],
    [40, null, 40],
    [null, 20, null],
  ])("adjusts raw %s with bin access %s to %s", (raw, bin, adjusted) => {
    expect(citizen.adjust(raw, bin)).toBe(adjusted);
  });
});

describe("Diagnoser", () => {
  const diagnoser = new Diagnoser();
  const calm = { citizenRaw: 80, binAccess: 80, medianDaysToClear: 1, clearedWithin7DaysPct: 90, redumpedPct: 0, binServicePct: 100 };

  it.each([
    ["infrastructure_gap", { citizenRaw: 40, binAccess: 30 }],
    ["behaviour", { citizenRaw: 40, binAccess: 50 }],
    ["city_response", { medianDaysToClear: 7.5 }],
    ["city_response", { clearedWithin7DaysPct: 49 }],
    ["city_response", { binServicePct: 40 }],
    ["repeat_spot", { redumpedPct: 20 }],
  ])("finds %s", (diagnosis, change) => {
    expect(diagnoser.diagnose({ ...calm, ...change })).toEqual([diagnosis]);
  });

  it("finds nothing in a calm area or from missing inputs", () => {
    expect(diagnoser.diagnose(calm)).toEqual([]);
    const missing = { citizenRaw: null, binAccess: null, medianDaysToClear: null, clearedWithin7DaysPct: null, redumpedPct: null, binServicePct: null };
    expect(diagnoser.diagnose(missing)).toEqual([]);
    expect(diagnoser.diagnose({ ...calm, citizenRaw: 10, binAccess: null })).toEqual([]);
  });

  it("can find several at once", () => {
    const input = { citizenRaw: 30, binAccess: 20, medianDaysToClear: 9, clearedWithin7DaysPct: 10, redumpedPct: 40, binServicePct: 0 };
    expect(diagnoser.diagnose(input)).toEqual(["infrastructure_gap", "city_response", "repeat_spot"]);
  });
});
