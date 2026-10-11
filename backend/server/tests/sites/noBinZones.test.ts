import { describe, expect, it } from "vitest";
import { NgeohashCells } from "../../src/adapters/sites/NgeohashCells.js";
import { SiteItemMapper } from "../../src/adapters/sites/SiteItemMapper.js";
import { validateSite, type ReportUpload } from "../../src/contracts/index.gen.js";
import { Report } from "../../src/domain/Report.js";
import type { MergeEvidence } from "../../src/domain/sites/MergeableReport.js";
import { MergeableReportFactory } from "../../src/domain/sites/MergeableReportFactory.js";
import { PublicMedia } from "../../src/domain/sites/PublicMedia.js";
import { Site } from "../../src/domain/sites/Site.js";
import { ConditionalStep } from "../../src/services/ConditionalStep.js";
import { ConflictRetry } from "../../src/services/sites/ConflictRetry.js";
import { MergeTargetPicker } from "../../src/services/sites/MergeTargetPicker.js";
import { SiteMerger } from "../../src/services/sites/SiteMerger.js";
import { BASE_LAT, BASE_LON, BASE_URL, evidence, northOf, siteFixture } from "./builders.js";
import { FakeEmbeddings, FakeReportStatus, FakeScoreSeeder, FakeSiteRepository, FakeVoteRepository, FixedClock, RecordingLogger } from "./fakes.js";
import { RETRY, RULES, SCORES } from "../defaults.js";

function fail(): never {
  throw new Error("no stored internals");
}

function setup() {
  const sites = new FakeSiteRepository();
  const merger = new SiteMerger({
    sites,
    votes: new FakeVoteRepository(),
    cells: new NgeohashCells(),
    picker: new MergeTargetPicker(new FakeEmbeddings(), RULES),
    reports: new FakeReportStatus(),
    scores: new FakeScoreSeeder(),
    clock: new FixedClock(),
    reportFactory: new MergeableReportFactory(new PublicMedia(BASE_URL)),
    retry: new ConflictRetry(RETRY.saveAttempts),
    rules: RULES,
    minVerifiedReports: SCORES.minVerifiedReports,
  });
  return { sites, merger };
}

// "No dustbin within 1 km of here", from person n at a point, without a photo (decision 20261010-1630).
function noBin(n: number, lat = BASE_LAT, lon = BASE_LON): MergeEvidence {
  const base = evidence({ id: `nb_${n}`, reportType: "no_bin", context: "no_bin", device: `device-${n}`, user: `user-${n}`, lat, lon });
  const upload: ReportUpload = { ...base.upload, gps: { lat, lon, accuracy_m: 12 } };
  delete upload.sha256;
  return { ...base, upload, moderation: null, verification: null };
}

describe("no-bin zones", () => {
  it("founds a zone from a report without a photo, unverified at 1 of 10, with its 1 km radius", async () => {
    const { merger, sites } = setup();
    expect(await merger.merge(noBin(1))).toMatchObject({ siteId: "site_nb_1", outcome: "founded", reportStatus: "unverified" });
    const zone = validateSite(sites.feature("site_nb_1")).properties;
    expect(zone).toMatchObject({ zone_radius_m: 1000, verification: "unverified", backers: { count: 1, needed: 10 }, photo_urls: [] });
  });

  it("publishes a one-person zone's centre only to about 100 m, and the exact centre once a second person backs it", async () => {
    const { merger, sites } = setup();
    await merger.merge(noBin(1, 26.261834, 73.003527));
    const first = Site.restore({ feature: sites.feature("site_nb_1"), internals: sites.internals("site_nb_1") ?? fail() }, RULES);
    expect(first.toFeature().geometry.coordinates).toEqual([73.004, 26.262]);
    expect(first.snapshot().feature.geometry.coordinates).toEqual([73.003527, 26.261834]);
    await merger.merge(noBin(2, 26.261834, 73.003527));
    const second = Site.restore({ feature: sites.feature("site_nb_1"), internals: sites.internals("site_nb_1") ?? fail() }, RULES);
    expect(second.toFeature().geometry.coordinates).toEqual([73.003527, 26.261834]);
  });

  it("joins the nearest zone whose centre is within 500 m, else founds another, and recentres on the mean", async () => {
    const { merger, sites } = setup();
    await merger.merge(noBin(1));
    expect((await merger.merge(noBin(2, northOf(400)))).siteId).toBe("site_nb_1");
    expect(sites.feature("site_nb_1").geometry.coordinates[1]).toBeCloseTo((BASE_LAT + northOf(400)) / 2, 6);
    expect((await merger.merge(noBin(3, northOf(1300)))).siteId).toBe("site_nb_3");
  });

  it("is verified when 10 different people report it, each counted once", async () => {
    const { merger, sites } = setup();
    for (let n = 1; n <= 9; n += 1) {
      await merger.merge(noBin(n, northOf(n * 10)));
    }
    await merger.merge({ ...noBin(10), upload: { ...noBin(10).upload, device_token: "device-1", user_id: "user-1" } });
    expect(sites.feature("site_nb_1").properties).toMatchObject({ verification: "unverified", backers: { count: 9 } });
    const result = await merger.merge(noBin(11, northOf(30)));
    expect(result).toMatchObject({ siteId: "site_nb_1", reportStatus: "verified" });
    expect(sites.feature("site_nb_1").properties).toMatchObject({ backers: { count: 10 }, verified_count: 11 });
  });

  it("keeps a no-bin photo without a waste check, but still needs it to pass moderation", () => {
    const factory = new MergeableReportFactory(new PublicMedia(BASE_URL));
    const withPhoto = evidence({ id: "nb_p", reportType: "no_bin", context: "no_bin" });
    expect(factory.create({ ...withPhoto, verification: null }).photoUrl).toBe(`${BASE_URL}/media/reports/rpt_nb_p.jpg`);
    const unsafe = { ...withPhoto, verification: null, moderation: { ...withPhoto.moderation, outcome: "rejected" as const } };
    expect(() => factory.create(unsafe)).toThrow(/did not pass/);
    expect(() => factory.create({ ...evidence(), verification: null })).toThrow(/did not pass/);
  });

  it("skips moderation without a photo, and the waste check and brands for every no-bin report", async () => {
    const ran: string[] = [];
    const step = (name: "moderate" | "verify") => ({ name, run: async () => void ran.push(name) });
    const upload = noBin(1).upload;
    const report = Report.receive(upload, "2026-10-10T05:00:00Z", "user-1");
    await new ConditionalStep(step("moderate"), (r) => r.hasPhoto()).run(report);
    await new ConditionalStep(step("verify"), (r) => r.hasPhoto() && r.needsWasteCheck()).run(report);
    expect(ran).toEqual([]);
    const photo = Report.receive(evidence().upload, "2026-10-10T05:00:00Z", "user-1");
    await new ConditionalStep(step("moderate"), (r) => r.hasPhoto()).run(photo);
    expect(ran).toEqual(["moderate"]);
  });

  it("reads an older no-bin site as a zone that later reports within 500 m join", async () => {
    const legacy = siteFixture("jdh-2");
    const { zone_radius_m: _radius, backers: _backers, ...older } = legacy.properties;
    expect([_radius, _backers.count]).toEqual([1000, 10]);
    const [lon, lat] = legacy.geometry.coordinates;
    const site = new SiteItemMapper(new NgeohashCells(), new RecordingLogger(), RULES).toSite({ ...older, lat, lon, report_ids: ["rpt_jdh_2"] });
    expect(site.toFeature().properties).toMatchObject({ zone_radius_m: 1000, report_type: "no_bin" });
    const { merger, sites } = setup();
    sites.put(site);
    expect((await merger.merge(noBin(5, lat + 0.002, lon))).siteId).toBe("site_jdh_2");
  });
});
