import { describe, expect, it } from "vitest";
import { validateSite } from "../../src/contracts/index.gen.js";
import { InsightMerge } from "../../src/domain/sites/InsightMerge.js";
import { Site } from "../../src/domain/sites/Site.js";
import { VoteTally } from "../../src/domain/sites/VoteTally.js";
import type { NearPlace, ReportInsights } from "../../src/domain/sites/SiteTypes.js";
import { DEVICE_B, report } from "./builders.js";

const YOLO = { signal: "yolo", provider: "junksnap", model: "yolo-junk-s", version: "v1" } as const;
const JUDGE = { signal: "vision_judge", provider: "bedrock", model: "global.anthropic.claude-sonnet-4-6", version: "4.6" } as const;
const SCHOOL: NearPlace = {
  kind: "school",
  distance_m: 83,
  ref: "osm:way/100000001",
  source: { source_url: "https://overpass-api.de/api/interpreter", fetched_at: "2026-10-10T01:00:00Z", page_sha256: "a".repeat(64) },
};

function insights(plastic: number | null, size: "small" | "medium" | "large" | null, hazards: ReportInsights["hazards"] = []): ReportInsights {
  return {
    composition: plastic === null ? [] : [{ material: "plastic", share_pct: plastic, source: YOLO }],
    size_class: size === null ? null : { value: size, source: JUDGE },
    hazards,
  };
}

describe("InsightMerge", () => {
  it("averages shares over every merged report, a missing material counting as 0", () => {
    const merged = new InsightMerge([insights(60, null), insights(30, null), insights(null, null)]).merged([]);
    expect(merged.reports).toBe(3);
    expect(merged.composition).toEqual([{ material: "plastic", share_pct: 30, reports: 2, sources: [YOLO] }]);
  });

  it("puts the largest material first, rounds to one decimal and lists each model once", () => {
    const first: ReportInsights = {
      composition: [
        { material: "paper", share_pct: 10, source: YOLO },
        { material: "plastic", share_pct: 55, source: YOLO },
      ],
      size_class: null,
      hazards: [],
    };
    const second: ReportInsights = { ...first, composition: [{ material: "plastic", share_pct: 50, source: JUDGE }] };
    const third: ReportInsights = { ...first, composition: [{ material: "plastic", share_pct: 52.5, source: YOLO }] };
    const merged = new InsightMerge([first, second, third]).merged([]);
    expect(merged.composition.map((entry) => [entry.material, entry.share_pct])).toEqual([["plastic", 52.5], ["paper", 3.3]]);
    expect(merged.composition[0]?.sources).toEqual([YOLO, JUDGE]);
  });

  it("takes the most common size class, ties going to the larger, and null when none", () => {
    expect(new InsightMerge([insights(null, "small"), insights(null, "large")]).merged([]).size_class).toEqual({
      value: "large",
      reports: 1,
      sources: [JUDGE],
    });
    const smalls = [insights(null, "small"), insights(null, "small"), insights(null, "large")];
    expect(new InsightMerge(smalls).merged([]).size_class?.value).toBe("small");
    expect(new InsightMerge([insights(null, null)]).merged([]).size_class).toBeNull();
  });

  it("lists every hazard any report showed with its report count, and keeps the nearby places", () => {
    const burning = { hazard: "burning", confidence: 0.9, source: JUDGE } as const;
    const medical = { hazard: "medical_waste", confidence: 0.7, source: YOLO } as const;
    const merged = new InsightMerge([insights(null, null, [burning, medical]), insights(null, null, [burning])]).merged([SCHOOL]);
    expect(merged.hazards).toEqual([
      { hazard: "burning", reports: 2, sources: [JUDGE] },
      { hazard: "medical_waste", reports: 1, sources: [YOLO] },
    ]);
    expect(merged.near).toEqual([SCHOOL]);
  });
});

const yes = (n: number) => ({ siteId: "s", deviceToken: `d${n}`, userId: null, choice: "confirm" as const, votedAt: "2026-10-10T05:00:00Z" });

describe("Site insights", () => {
  it("keeps the founding report's nearby places as the site's, through later merges", () => {
    const site = Site.found(report({ decision: "community_check", near: [SCHOOL] }));
    expect(site.toFeature().properties.insights?.near).toEqual([SCHOOL]);
    site.merge(report({ id: "jdh_2", device: DEVICE_B, near: [] }));
    site.recordVotes(VoteTally.of(Array.from({ length: 8 }, (_, n) => yes(n))));
    const properties = validateSite(site.toFeature()).properties;
    expect(properties.insights).toMatchObject({ reports: 2, near: [SCHOOL] });
  });

  it("merges only reports without insights as zero reports", () => {
    const site = Site.found(report({ insights: null }));
    site.recordVotes(VoteTally.of(Array.from({ length: 9 }, (_, n) => yes(n))));
    expect(site.toFeature().properties).toMatchObject({ verified_count: 1, insights: { reports: 0, composition: [] } });
  });
});
