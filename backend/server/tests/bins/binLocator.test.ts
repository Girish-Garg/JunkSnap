import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FileAssetReader } from "../../src/adapters/FileAssetReader.js";
import { FileBinSource } from "../../src/adapters/FileBinSource.js";
import { BinGrid } from "../../src/domain/bins/BinGrid.js";
import type { KnownBin } from "../../src/domain/bins/KnownBin.js";
import { GeoPoint } from "../../src/domain/sites/GeoPoint.js";
import { BinLocator } from "../../src/services/BinLocator.js";
import { BinSettings } from "../../src/settings/BinSettings.js";

const SOURCE = { source_url: "https://overpass-api.de/api/interpreter", fetched_at: "2026-10-10T01:00:00Z", page_sha256: "a".repeat(64) };
const SITE = new GeoPoint(26.2618, 73.0035);

// A point the given metres due north of SITE.
function north(metres: number): GeoPoint {
  return new GeoPoint(SITE.lat + (metres / 6_371_008.8) * (180 / Math.PI), SITE.lon);
}

function bin(ref: string, point: GeoPoint): KnownBin {
  return { point, ref, source: SOURCE };
}

describe("BinGrid", () => {
  it("finds the nearest bin across cells, out to tens of kilometres", () => {
    const grid = new BinGrid([bin("osm:node/far", north(20_000)), bin("osm:node/near", north(7_000)), bin("osm:node/east", new GeoPoint(SITE.lat, SITE.lon + 0.2))]);
    const found = grid.nearest(SITE);
    expect(found?.bin.ref).toBe("osm:node/near");
    expect(found?.distanceM).toBeCloseTo(7_000, 0);
  });

  it("picks the closer bin even when a farther one shares the site's cell", () => {
    const sameCell = new GeoPoint(Math.floor(SITE.lat / 0.05) * 0.05 + 0.001, Math.floor(SITE.lon / 0.05) * 0.05 + 0.001);
    const justOutside = new GeoPoint(SITE.lat, Math.ceil(SITE.lon / 0.05) * 0.05 + 0.0001);
    const expected = SITE.distanceTo(sameCell) < SITE.distanceTo(justOutside) ? "osm:node/same" : "osm:node/outside";
    expect(new BinGrid([bin("osm:node/same", sameCell), bin("osm:node/outside", justOutside)]).nearest(SITE)?.bin.ref).toBe(expected);
  });

  it("returns null with no bins in reach", () => {
    expect(new BinGrid([]).nearest(SITE)).toBeNull();
    expect(new BinGrid([bin("osm:node/1", north(200_000))]).nearest(SITE)).toBeNull();
  });
});

describe("BinLocator", () => {
  const data = { bins: [bin("osm:node/1", north(1_200))], mappedTowns: ["jodhpur"] };

  it("reports the nearest known bin and whether it lies within the radius", () => {
    expect(new BinLocator(data, 3000).measure(SITE, "Jodhpur")).toEqual({
      nearest_bin: { distance_m: 1200, ref: "osm:node/1", source: SOURCE },
      no_bin_within_3km: false,
    });
    expect(new BinLocator(data, 1000).measure(SITE, "Jodhpur").no_bin_within_3km).toBe(true);
  });

  it("flags a mapped town with no bin in reach and leaves an unmapped town unmeasured", () => {
    const empty = new BinLocator({ bins: [], mappedTowns: ["jodhpur"] }, 3000);
    expect(empty.measure(SITE, "Jodhpur")).toEqual({ nearest_bin: null, no_bin_within_3km: true });
    expect(new BinLocator(data, 3000).measure(SITE, "Jaipur")).toEqual({ nearest_bin: null, no_bin_within_3km: null });
    expect(new BinLocator(data, 3000).measure(SITE, null)).toEqual({ nearest_bin: null, no_bin_within_3km: null });
  });
});

describe("FileBinSource", () => {
  let assets: string;

  beforeAll(async () => {
    assets = await mkdtemp(join(tmpdir(), "server-79-bin-access-"));
    await mkdir(join(assets, "wards"));
    const disposal = { kind: "disposal", count: 2, ...SOURCE, features: [
      { ref: "osm:node/10", coords: [[26.27, 73.01]] },
      { ref: "osm:way/11", coords: [[26.28, 73.02], [26.30, 73.04]] },
    ] };
    const school = { kind: "school", count: 1, ...SOURCE, features: [{ ref: "osm:node/12", coords: [[26.2, 73.0]] }] };
    const point = { lat: 26.25, lon: 73.0, kind: "collection_point", ref: "osm:node/13", ...SOURCE };
    const records = [
      { review_status: "reviewed", disposal_points: [point] },
      { review_status: "unreviewed", disposal_points: [{ ...point, ref: "osm:node/14" }] },
    ];
    await writeFile(join(assets, "wards", "jodhpur.json"), JSON.stringify({ records, map_layers: [disposal, school] }));
    await writeFile(join(assets, "wards", "jaipur.json"), JSON.stringify({ records: [], map_layers: [school] }));
    const empty = { ...disposal, count: 0, features: [] };
    await writeFile(join(assets, "wards", "udaipur.json"), JSON.stringify({ records: [], map_layers: [empty] }));
  });

  afterAll(async () => {
    await rm(assets, { recursive: true, force: true });
  });

  it("reads disposal-layer features and reviewed ward disposal points; a town is mapped only with a known bin", async () => {
    const data = await new FileBinSource(new FileAssetReader(assets), assets).load();
    expect(data.bins.map((each) => each.ref)).toEqual(["osm:node/10", "osm:way/11", "osm:node/13"]);
    expect(data.bins[1]?.point).toEqual(new GeoPoint(26.29, 73.03));
    expect(data.mappedTowns).toEqual(["jodhpur"]);
  });

  it("leaves a town whose disposal layer is empty unmeasured rather than no-bin", async () => {
    const data = await new FileBinSource(new FileAssetReader(assets), assets).load();
    const site = new GeoPoint(24.58, 73.71);
    expect(new BinLocator(data, 3000).measure(site, "Udaipur")).toEqual({ nearest_bin: null, no_bin_within_3km: null });
  });

  it("knows nothing without a wards folder", async () => {
    const missing = join(assets, "nothing-here");
    expect(await new FileBinSource(new FileAssetReader(missing), missing).load()).toEqual({ bins: [], mappedTowns: [] });
  });
});

describe("BinSettings", () => {
  it("defaults to 3000 m and 5 reporters and reads overrides", () => {
    expect(BinSettings.fromEnv({})).toMatchObject({ radiusM: 3000, minReporters: 5 });
    expect(BinSettings.fromEnv({ BIN_RADIUS_M: "2500", NO_BIN_MIN_REPORTERS: "3" })).toMatchObject({ radiusM: 2500, minReporters: 3 });
    expect(() => BinSettings.fromEnv({ BIN_RADIUS_M: "-1" })).toThrow(/BIN_RADIUS_M/);
  });
});
