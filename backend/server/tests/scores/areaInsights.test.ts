import { describe, expect, it } from "vitest";
import type { AreaFactSheet } from "../../src/domain/AreaFactSheet.js";
import type { AreaSite } from "../../src/domain/AreaSite.js";
import type { Position } from "../../src/domain/GeoPoint.js";
import { SensitivePlace } from "../../src/domain/SensitivePlace.js";
import { ScoreCalculator } from "../../src/services/ScoreCalculator.js";
import { HERE, insights, NO_FACTS, NOW, northOf, site, WARD } from "./siteBuilder.js";

const calculator = ScoreCalculator.standard();

function areaInsights(sites: readonly AreaSite[], facts: AreaFactSheet = NO_FACTS) {
  return calculator.calculate({ area: WARD, sites, facts, now: NOW }).insights;
}

// Enough verified reports for shares and patterns to show.
const filler = () => site({ verifiedCount: 10, firstReportedAt: "2026-10-01T00:00:00Z" });

function placeAt(kind: SensitivePlace["kind"], metresNorth: number): SensitivePlace {
  const point = northOf(metresNorth);
  return new SensitivePlace(kind, [[[point.lon, point.lat]]], false);
}

describe("composition", () => {
  it("averages each material over reports, weighting each site by its report count", () => {
    const sites = [
      site({ insights: insights({ reports: 2, composition: [{ material: "plastic", share_pct: 50 }, { material: "organic", share_pct: 30 }] }) }),
      site({ insights: insights({ reports: 1, composition: [{ material: "plastic", share_pct: 20 }, { material: "paper", share_pct: 40 }] }) }),
      filler(),
    ];
    expect(areaInsights(sites).composition).toEqual({
      value: [
        { material: "plastic", share_pct: 40 },
        { material: "organic", share_pct: 20 },
        { material: "paper", share_pct: 13.3 },
      ],
      reports: 3,
      reason: null,
    });
  });

  it("says no_data when no verified site carries an estimate, and too_few_reports below the guardrail", () => {
    expect(areaInsights([filler()]).composition).toEqual({ value: null, reports: 0, reason: "no_data" });
    const few = [site({ insights: insights({ reports: 2, composition: [{ material: "glass", share_pct: 10 }] }) })];
    expect(areaInsights(few).composition).toEqual({ value: null, reports: 2, reason: "too_few_reports" });
  });

  it("ignores sites waiting for a neighbour check", () => {
    const pending = site({ verification: "community_check", insights: insights({ reports: 4, composition: [{ material: "metal", share_pct: 90 }] }) });
    expect(areaInsights([pending, filler()]).composition.reports).toBe(0);
  });
});

describe("hazardous_share_pct", () => {
  it("counts sites with burning or a hazard in their insights", () => {
    const sites = [
      site({ burning: true, insights: insights() }),
      site({ insights: insights({ hazards: [{ hazard: "medical_waste" }] }) }),
      site({ insights: insights() }),
      filler(),
    ];
    expect(areaInsights(sites).hazardous_share_pct).toEqual({ value: 50, hazardous_sites: 2, sites: 4, reason: null });
  });

  it("says no_data until some site carries insights", () => {
    expect(areaInsights([site({ burning: true }), filler()]).hazardous_share_pct).toEqual({
      value: null,
      hazardous_sites: 1,
      sites: 2,
      reason: "no_data",
    });
  });
});

describe("top_brands", () => {
  const label = (brand: string, confidence = 0.9) => ({ brand, parentCompany: `${brand} Ltd`, confidence });

  it("ranks readable labels by count, shows sites per brand and stays visible below the guardrail", () => {
    const sites = [
      site({ brands: [label("Sample Namkeen"), label("Sample Namkeen"), label("Sample Cola")] }),
      site({ brands: [label("Sample Namkeen"), label("Blurry Chips", 0.79)] }),
    ];
    expect(areaInsights(sites).top_brands).toEqual({
      value: [
        { brand: "Sample Namkeen", parent_company: "Sample Namkeen Ltd", sites: 2, labels: 3 },
        { brand: "Sample Cola", parent_company: "Sample Cola Ltd", sites: 1, labels: 1 },
      ],
      labels: 4,
      reason: null,
    });
  });

  it("lists at most five brands", () => {
    const brands = ["A", "B", "C", "D", "E", "F"].map((name) => label(name));
    expect(areaInsights([site({ brands })]).top_brands.value).toHaveLength(5);
  });
});

describe("repeat_spots", () => {
  it("lists reopened sites and sites reported on two IST days, most reports first", () => {
    const reopened = site({ siteId: "site_reopened", verifiedCount: 2, status: "reopened", cleanedAt: "2026-10-12T00:00:00Z" });
    // 18:00Z and 19:00Z on 10 Oct are 23:30 and 00:30 IST: two IST days.
    const twoDays = site({ siteId: "site_two_days", verifiedCount: 3, reportTimes: [Date.parse("2026-10-10T18:00:00Z"), Date.parse("2026-10-10T19:00:00Z")] });
    const sameDay = site({ siteId: "site_same_day", verifiedCount: 5, reportTimes: [Date.parse("2026-10-10T01:00:00Z"), Date.parse("2026-10-10T17:00:00Z")] });
    expect(areaInsights([reopened, twoDays, sameDay]).repeat_spots).toEqual({
      value: ["site_two_days", "site_reopened"],
      count: 2,
      reason: null,
    });
  });
});

describe("hour_of_day and day_of_week", () => {
  const times = ["2026-10-12T04:00:00Z", "2026-10-11T20:00:00Z", "2026-10-10T05:00:00Z"].map(Date.parse);

  it("buckets verified report times by IST hour and IST weekday, Monday first", () => {
    const result = areaInsights([site({ verifiedCount: 10, firstReportedAt: "2026-10-01T00:00:00Z", reportTimes: times })]);
    const hours = new Array<number>(24).fill(0);
    hours[9] = 1;
    hours[1] = 1;
    hours[10] = 1;
    expect(result.hour_of_day).toEqual({ value: hours, reports: 3, reason: null });
    expect(result.day_of_week).toEqual({ value: [2, 0, 0, 0, 0, 1, 0], reports: 3, reason: null });
  });

  it("withholds both below the guardrail and the weekday pattern in a window under 7 days", () => {
    const young = areaInsights([site({ verifiedCount: 10, firstReportedAt: "2026-10-15T00:00:00Z", reportTimes: times })]);
    expect(young.hour_of_day.reason).toBeNull();
    expect(young.day_of_week).toEqual({ value: null, reports: 3, reason: "no_data" });
    const few = areaInsights([site({ verifiedCount: 3, reportTimes: times })]);
    expect(few.hour_of_day).toEqual({ value: null, reports: 3, reason: "too_few_reports" });
    expect(few.day_of_week.reason).toBe("too_few_reports");
  });
});

describe("near_school_or_water_count", () => {
  it("uses the worker's site insights, else measures sites against the ward's places", () => {
    const sites = [
      site({ insights: insights({ near: [{ kind: "school", distance_m: 83 }] }) }),
      site({ insights: insights({ near: [{ kind: "hospital", distance_m: 40 }] }) }),
      site({ point: HERE }),
      site({ point: northOf(500) }),
    ];
    const facts = { ...NO_FACTS, sensitivePlaces: [placeAt("open_drain", 60), placeAt("hospital", 480)] };
    expect(areaInsights(sites, facts).near_school_or_water_count).toEqual({ value: 2, sites: 4, reason: null });
  });

  it("says no_data when nothing was crawled for the area, even below the guardrail", () => {
    expect(areaInsights([site()]).near_school_or_water_count).toEqual({ value: null, sites: 1, reason: "no_data" });
  });
});

describe("SensitivePlace.distanceFrom", () => {
  const at = (metresNorth: number, metresEast = 0): Position => {
    const north = northOf(metresNorth);
    return [HERE.lon + (metresEast / (6_371_000 * Math.cos((HERE.lat * Math.PI) / 180))) * (180 / Math.PI), north.lat];
  };

  it("measures to the nearest point of a line", () => {
    const drain = new SensitivePlace("open_drain", [[at(50, -100), at(50, 100)]], false);
    expect(drain.distanceFrom(HERE)).toBeCloseTo(50, 0);
  });

  it("is zero inside a water body and the edge distance outside it", () => {
    const ring = [at(-50, -50), at(-50, 50), at(50, 50), at(50, -50), at(-50, -50)];
    const pond = new SensitivePlace("water_body", [ring], true);
    expect(pond.distanceFrom(HERE)).toBe(0);
    expect(pond.distanceFrom(northOf(130))).toBeCloseTo(80, 0);
  });
});
