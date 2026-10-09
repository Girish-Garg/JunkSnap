import { describe, expect, it } from "vitest";
import type { AreaFactSheet } from "../../src/domain/AreaFactSheet.js";
import type { AreaSite } from "../../src/domain/AreaSite.js";
import { ScoreCalculator } from "../../src/services/ScoreCalculator.js";
import { insights, JUDGE, NO_FACTS, NOW, nearPlace, share, site, WARD, YOLO } from "./siteBuilder.js";

const calculator = ScoreCalculator.standard();

function areaInsights(sites: readonly AreaSite[], facts: AreaFactSheet = NO_FACTS) {
  return calculator.calculate({ area: WARD, sites, facts, now: NOW }).insights;
}

// Enough verified reports for shares and patterns to show.
const filler = () => site({ verifiedCount: 10, firstReportedAt: "2026-10-01T00:00:00Z" });

describe("composition", () => {
  it("averages each material over reports, weighting each site by its report count, and lists its models", () => {
    const sites = [
      site({ insights: insights({ reports: 2, composition: [share("plastic", 50, JUDGE), share("organic", 30)] }) }),
      site({ insights: insights({ reports: 1, composition: [share("plastic", 20), share("paper", 40, JUDGE)] }) }),
      filler(),
    ];
    expect(areaInsights(sites).composition).toEqual({
      value: [
        { material: "plastic", share_pct: 40 },
        { material: "organic", share_pct: 20 },
        { material: "paper", share_pct: 13.3 },
      ],
      reports: 3,
      sources: [JUDGE, YOLO],
      reason: null,
    });
  });

  it("says no_data when no verified site carries an estimate, and too_few_reports below the guardrail", () => {
    expect(areaInsights([filler()]).composition).toEqual({ value: null, reports: 0, sources: [], reason: "no_data" });
    const few = [site({ insights: insights({ reports: 2, composition: [share("glass", 10)] }) })];
    expect(areaInsights(few).composition).toEqual({ value: null, reports: 2, sources: [], reason: "too_few_reports" });
  });

  it("ignores sites waiting for a neighbour check", () => {
    const pending = site({ verification: "community_check", insights: insights({ reports: 4, composition: [share("metal", 90)] }) });
    expect(areaInsights([pending, filler()]).composition.reports).toBe(0);
  });
});

describe("hazardous_share_pct", () => {
  const medical = { hazard: "medical_waste" as const, reports: 1, sources: [YOLO] as [typeof YOLO] };

  it("counts sites with burning or a hazard in their insights", () => {
    const sites = [
      site({ burning: true, insights: insights() }),
      site({ insights: insights({ hazards: [medical] }) }),
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
  const mapped: AreaFactSheet = { ...NO_FACTS, placesMapped: true };

  it("counts sites with a school or water place in site.insights.near, never a hospital or drain alone", () => {
    const sites = [
      site({ insights: insights({ near: [nearPlace("school", 83)] }) }),
      site({ insights: insights({ near: [nearPlace("drain", 2), nearPlace("water", 60)] }) }),
      site({ insights: insights({ near: [nearPlace("hospital", 40), nearPlace("drain", 10)] }) }),
      site({ insights: insights() }),
      site(),
    ];
    expect(areaInsights(sites, mapped).near_school_or_water_count).toEqual({ value: 2, sites: 5, reason: null });
  });

  it("shows 0 in a mapped city with nothing near, even below the guardrail", () => {
    expect(areaInsights([site({ insights: insights() })], mapped).near_school_or_water_count).toEqual({ value: 0, sites: 1, reason: null });
  });

  it("says no_data when the city has no crawled map layers", () => {
    expect(areaInsights([site({ insights: insights() })]).near_school_or_water_count).toEqual({ value: null, sites: 1, reason: "no_data" });
  });
});
