import { describe, expect, it } from "vitest";
import { NgeohashCells } from "../../src/adapters/sites/NgeohashCells.js";
import { validateSite, type LocationLookup, type ReportUpload } from "../../src/contracts/index.gen.js";
import { Report } from "../../src/domain/Report.js";
import { BoundingBox } from "../../src/domain/sites/BoundingBox.js";
import { GeoPoint } from "../../src/domain/sites/GeoPoint.js";
import type { MergeEvidence } from "../../src/domain/sites/MergeableReport.js";
import { MergeableReportFactory } from "../../src/domain/sites/MergeableReportFactory.js";
import { PublicMedia } from "../../src/domain/sites/PublicMedia.js";
import type { LatLon, ReportLocator } from "../../src/ports/ReportLocator.js";
import { BinLocator } from "../../src/services/BinLocator.js";
import { LocateStep } from "../../src/services/LocateStep.js";
import { NearPlacesFinder } from "../../src/services/NearPlacesFinder.js";
import { ConflictRetry } from "../../src/services/sites/ConflictRetry.js";
import { MergeTargetPicker } from "../../src/services/sites/MergeTargetPicker.js";
import { SiteFinder } from "../../src/services/sites/SiteFinder.js";
import { SiteMerger } from "../../src/services/sites/SiteMerger.js";
import { SiteReportMerger } from "../../src/services/wiring/SiteReportMerger.js";
import { BASE_LAT, BASE_LON, BASE_URL, DEVICE_B, DEVICE_C, evidence, fixture, northOf } from "./builders.js";
import { FakeEmbeddings, FakeReportStatus, FakeScoreSeeder, FakeSiteRepository, FakeVoteRepository, FixedClock } from "./fakes.js";

// The first reporter stood about 128 m from the waste (100 m north, 80 m east) and marked it at BASE.
const REPORTER = { lat: 26.26273, lon: 73.00432, accuracy_m: 6 };
const WASTE = { lat: BASE_LAT, lon: BASE_LON };

// A jdh-1 photo taken from `gps`, marked at `target` when given.
function longRange(id: string, device: string, gps: { lat: number; lon: number }, target?: LatLon): MergeEvidence {
  const base = evidence({ id, device, lat: gps.lat, lon: gps.lon });
  const upload: ReportUpload = { ...base.upload, ...(target === undefined ? {} : { target: { ...target } }) };
  return { ...base, upload };
}

function setup() {
  const sites = new FakeSiteRepository();
  const merger = new SiteMerger({
    sites,
    votes: new FakeVoteRepository(),
    cells: new NgeohashCells(),
    picker: new MergeTargetPicker(new FakeEmbeddings()),
    reports: new FakeReportStatus(),
    scores: new FakeScoreSeeder(),
    clock: new FixedClock(),
    reportFactory: new MergeableReportFactory(new PublicMedia(BASE_URL)),
    retry: new ConflictRetry(),
  });
  return { sites, merger, finder: new SiteFinder(sites, new NgeohashCells(), new FixedClock()) };
}

describe("site placement from a long-range target", () => {
  it("puts the site at the target, never at the reporter's position", async () => {
    const { sites, merger } = setup();
    const result = await merger.merge(longRange("far_1", DEVICE_B, REPORTER, WASTE));
    const feature = validateSite(sites.feature(result.siteId));
    expect(feature.geometry.coordinates).toEqual([BASE_LON, BASE_LAT]);
    expect(sites.internals(result.siteId)?.reports[0]?.point).toEqual(WASTE);
  });

  it("founds a new site for a plain report taken where the long-range reporter stood", async () => {
    const { merger } = setup();
    const first = await merger.merge(longRange("far_1", DEVICE_B, REPORTER, WASTE));
    const here = await merger.merge(longRange("here_1", DEVICE_C, REPORTER));
    expect(here.outcome).toBe("founded");
    expect(here.siteId).not.toBe(first.siteId);
  });

  it("never exposes the reporter's position in GET /sites or GET /sites/{id}", async () => {
    const { merger, finder } = setup();
    const { siteId } = await merger.merge(longRange("far_1", DEVICE_B, REPORTER, WASTE));
    const listed = await finder.inBox(BoundingBox.around(new GeoPoint(BASE_LAT, BASE_LON), 1000));
    for (const feature of [...listed, await finder.byId(siteId)]) {
      const text = JSON.stringify(feature);
      expect(text).not.toContain(String(REPORTER.lat));
      expect(text).not.toContain(String(REPORTER.lon));
      expect(feature.geometry.coordinates).toEqual([BASE_LON, BASE_LAT]);
    }
  });
});

describe("worker steps that use the target", () => {
  it("looks up the ward and seats at the target", async () => {
    const asked: LatLon[] = [];
    const locator: ReportLocator = {
      locate: async (point) => (asked.push(point), fixture<LocationLookup>("location_lookup.jdh-1.json")),
    };
    const upload = longRange("far_1", DEVICE_B, REPORTER, WASTE).upload;
    const report = Report.receive(upload, "2026-10-10T02:14:52Z", "user-1");
    await new LocateStep(locator).run(report);
    expect(asked).toEqual([expect.objectContaining(WASTE)]);
    expect(report.toRecord().gps).toEqual(REPORTER);
  });

  it("measures nearby places and the nearest bin from the target", async () => {
    const source = { source_url: "https://overpass.example/api", fetched_at: "2026-10-09T22:00:00Z", page_sha256: "b".repeat(64) };
    const school = { kind: "school" as const, source, features: [{ ref: "osm:node/1", coords: [[BASE_LAT, BASE_LON]] as [number, number][] }] };
    const bins = new BinLocator({ bins: [{ point: new GeoPoint(northOf(30), BASE_LON), ref: "osm:node/2", source }], mappedTowns: ["jodhpur"] }, 3000);
    const seen: MergeEvidence[] = [];
    const sites = { merge: async (e: MergeEvidence) => (seen.push(e), { siteId: "site_far_1", outcome: "founded", reportStatus: "unverified" }) };
    const subject = new SiteReportMerger(sites as unknown as SiteMerger, new NearPlacesFinder([school]), bins);
    const e = longRange("far_1", DEVICE_B, REPORTER, WASTE);
    const record = { ...Report.receive(e.upload, "2026-10-10T02:14:52Z").toRecord(), moderation_result: e.moderation ?? undefined, verification_result: e.verification ?? undefined, location: e.location };
    await subject.merge(record);
    expect(seen[0]?.near).toEqual([expect.objectContaining({ ref: "osm:node/1", distance_m: 0 })]);
    expect(seen[0]?.bin).toMatchObject({ nearest_bin: { ref: "osm:node/2", distance_m: 30 } });
  });
});
