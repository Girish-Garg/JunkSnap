import { describe, expect, it } from "vitest";
import { validateSite } from "../../src/contracts/index.gen.js";
import { UNMEASURED, type BinMeasure } from "../../src/domain/bins/KnownBin.js";
import { Site } from "../../src/domain/sites/Site.js";
import { DEVICE_A, DEVICE_B, DEVICE_C, report } from "./builders.js";
import { RULES } from "../defaults.js";

const SOURCE = { source_url: "https://overpass-api.de/api/interpreter", fetched_at: "2026-10-10T01:00:00Z", page_sha256: "a".repeat(64) };
const FAR: BinMeasure = { nearest_bin: { distance_m: 4210, ref: "osm:node/7", source: SOURCE }, no_bin_within_3km: true };

describe("Site reporters", () => {
  it("counts distinct people: by user id, else by device", () => {
    const site = Site.found(report({ id: "b1", device: DEVICE_A }), RULES);
    site.merge(report({ id: "b2", device: DEVICE_B }));
    site.merge(report({ id: "b3", device: DEVICE_C, user: "user-3f6c2a1e" }));
    site.merge(report({ id: "b4", device: DEVICE_A }));
    site.merge(report({ id: "b5", device: DEVICE_C, user: null }));
    const properties = validateSite(site.toFeature()).properties;
    expect(properties.report_count).toBe(5);
    expect(properties.reporters).toBe(3);
  });
});

describe("Site nearest bin", () => {
  it("keeps the founding report's measure through later merges and insight refreshes", () => {
    const site = Site.found(report({ id: "n1", bin: FAR, reportType: "no_bin", context: "no_bin" }), RULES);
    site.merge(report({ id: "n2", device: DEVICE_B, bin: UNMEASURED, reportType: "no_bin", context: "no_bin" }));
    const insights = validateSite(site.toFeature()).properties.insights;
    expect(insights).toMatchObject({ nearest_bin: { distance_m: 4210, ref: "osm:node/7" }, no_bin_within_3km: true });
  });

  it("lets a site founded before bins were measured take the first measured report's reading", () => {
    const site = Site.found(report({ id: "o1", bin: UNMEASURED }), RULES);
    expect(site.toFeature().properties.insights?.no_bin_within_3km).toBeNull();
    site.merge(report({ id: "o2", device: DEVICE_B, bin: FAR }));
    expect(site.toFeature().properties.insights).toMatchObject({ no_bin_within_3km: true, nearest_bin: { distance_m: 4210 } });
  });
});
