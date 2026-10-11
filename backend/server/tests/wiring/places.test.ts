import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { DirectoryWardFiles } from "../../src/adapters/wards/DirectoryWardFiles.js";
import { FileMapLayerSource } from "../../src/adapters/FileMapLayerSource.js";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import type { SiteFeature } from "../../src/domain/sites/SiteTypes.js";
import type { MapLayer } from "../../src/domain/MapLayer.js";
import { QueueMessage } from "../../src/domain/QueueMessage.js";
import { Report } from "../../src/domain/Report.js";
import { ValidationError } from "../../src/domain/errors.js";
import type { BoundingBox } from "../../src/domain/sites/BoundingBox.js";
import { NearPlacesFinder } from "../../src/services/NearPlacesFinder.js";
import type { SiteFinder } from "../../src/services/sites/SiteFinder.js";
import type { VideoScanProcessor } from "../../src/services/VideoScanProcessor.js";
import { ScanMessageHandler } from "../../src/services/wiring/ScanMessageHandler.js";
import { SiteNearbyCounter } from "../../src/services/wiring/SiteNearbyCounter.js";
import { LogSink } from "../LogSink.js";
import { TempDirs } from "../TempDirs.js";
import { upload } from "../reportFakes.js";
import { siteFixture } from "../sites/builders.js";

const SITE = { lat: 26.26183, lon: 73.00352 };
const NORTH_PER_M = 1 / 110_574;
const SOURCE = { source_url: "https://overpass.example/api", fetched_at: "2026-10-09T22:00:00Z", page_sha256: "c".repeat(64) };

const north = (metres: number): [number, number] => [SITE.lat + metres * NORTH_PER_M, SITE.lon];

describe("NearPlacesFinder", () => {
  const layers: MapLayer[] = [
    { kind: "school", source: SOURCE, features: [{ ref: "osm:node/1", coords: [north(80)] }, { ref: "osm:node/2", coords: [north(150)] }] },
    { kind: "drain", source: SOURCE, features: [{ ref: "osm:way/3", coords: [north(-30), north(30)] }] },
    { kind: "water", source: SOURCE, features: [{ ref: "osm:way/4", coords: [north(60), north(120)] }] },
  ];

  it("keeps places within 100 m, nearest first, measuring to the nearest vertex or edge", () => {
    const near = new NearPlacesFinder(layers).near(SITE.lat, SITE.lon);
    expect(near.map((place) => [place.kind, place.ref, place.distance_m])).toEqual([
      ["drain", "osm:way/3", 0],
      ["water", "osm:way/4", 60],
      ["school", "osm:node/1", 80],
    ]);
    expect(near[0]?.source).toEqual(SOURCE);
  });

  it("finds nothing without layers", () => {
    expect(new NearPlacesFinder([]).near(SITE.lat, SITE.lon)).toEqual([]);
  });
});

describe("FileMapLayerSource", () => {
  const temp = new TempDirs();
  afterAll(() => temp.removeAll());

  function assets(cities: Record<string, unknown>): string {
    const root = temp.make("junksnap-layers-");
    mkdirSync(join(root, "wards"));
    for (const [name, body] of Object.entries(cities)) {
      writeFileSync(join(root, "wards", name), JSON.stringify(body));
    }
    return root;
  }

  const layer = (kind: string) => ({ kind, count: 1, ...SOURCE, features: [{ ref: "osm:node/9", coords: [[26.2, 73.0]] }] });

  it("reads the sensitive-place layers of every city and skips disposal points and bad layers", async () => {
    const root = assets({
      "jodhpur.json": { records: [], map_layers: [layer("school"), layer("disposal"), { kind: "water", features: "bad" }] },
      "jaipur.json": { records: [], map_layers: [layer("hospital")] },
      "README.md": "not json",
    });
    const layers = await new FileMapLayerSource(new DirectoryWardFiles(join(root, "wards"))).layers();
    expect(layers.map((one) => one.kind).sort()).toEqual(["hospital", "school"]);
    expect(layers[0]?.source).toEqual(SOURCE);
  });

  it("has no layers without a wards folder", async () => {
    const root = temp.make("junksnap-empty-");
    expect(await new FileMapLayerSource(new DirectoryWardFiles(join(root, "wards"))).layers()).toEqual([]);
  });
});

describe("SiteNearbyCounter", () => {
  function site(changes: Partial<SiteFeature["properties"]>, lat = SITE.lat): SiteFeature {
    const base = siteFixture("jdh-1");
    return { ...base, geometry: { type: "Point", coordinates: [SITE.lon, lat] }, properties: { ...base.properties, ...changes } };
  }

  it("sums verified reports on verified sites of the same type within 40 m", async () => {
    const boxes: BoundingBox[] = [];
    const sites = [
      site({ verification: "verified", verified_count: 3 }),
      site({ verification: "unverified", verified_count: 0 }),
      site({ verification: "verified", verified_count: 2, report_type: "no_bin", context: "no_bin" }),
      site({ verification: "verified", verified_count: 5 }, north(60)[0]),
    ];
    const finder = { inBox: async (box: BoundingBox) => (boxes.push(box), sites) };
    const record = Report.receive({ ...upload(), gps: { ...SITE, accuracy_m: 6 } }, "2026-10-10T02:14:52Z").toRecord();
    expect(await new SiteNearbyCounter(finder as unknown as SiteFinder).count(record)).toBe(3);
    expect(boxes).toHaveLength(1);
  });
});

describe("ScanMessageHandler", () => {
  function handler(fail: boolean, marks = true) {
    const calls: string[] = [];
    const processor = {
      process: async (scanId: string) => {
        calls.push(`process ${scanId}`);
        if (fail) throw new Error("ffmpeg failed");
      },
      markExhausted: async (scanId: string) => {
        calls.push(`exhausted ${scanId}`);
        return marks;
      },
    };
    const sink = new LogSink();
    const logger = new JsonLoggerFactory(sink).create({ service: "worker", stage: "dev" });
    return { calls, sink, subject: new ScanMessageHandler(processor as unknown as VideoScanProcessor, logger) };
  }

  const scan = (receiveCount: number, scanId: unknown = "scn_jpr_1") => new QueueMessage({ kind: "scan", scan_id: scanId }, receiveCount, 3);

  it("processes the scan named in the message", async () => {
    const { calls, subject } = handler(false);
    await subject.handle(scan(1));
    expect(calls).toEqual(["process scn_jpr_1"]);
  });

  it("fails the scan with retries_exhausted only on the last receive, and still rethrows", async () => {
    const { calls, sink, subject } = handler(true);
    await expect(subject.handle(scan(2))).rejects.toThrow("ffmpeg failed");
    await expect(subject.handle(scan(3))).rejects.toThrow("ffmpeg failed");
    expect(calls).toEqual(["process scn_jpr_1", "process scn_jpr_1", "exhausted scn_jpr_1"]);
    expect(sink.records().map((record) => record.message)).toContain("scan failed after the last attempt");
  });

  it("logs no failure when the last receive finds the scan already finished", async () => {
    const { calls, sink, subject } = handler(true, false);
    await expect(subject.handle(scan(3))).rejects.toThrow("ffmpeg failed");
    expect(calls).toEqual(["process scn_jpr_1", "exhausted scn_jpr_1"]);
    expect(sink.records().map((record) => record.message)).not.toContain("scan failed after the last attempt");
  });

  it("rejects a message without a valid scan id", async () => {
    await expect(handler(false).subject.handle(scan(1, "rpt_x"))).rejects.toThrow(ValidationError);
  });
});
