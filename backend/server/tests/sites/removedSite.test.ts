import { describe, expect, it } from "vitest";
import { NgeohashCells } from "../../src/adapters/sites/NgeohashCells.js";
import type { ModerationResult, VerificationResult } from "../../src/contracts/index.gen.js";
import { validateSite } from "../../src/contracts/index.gen.js";
import { PublicMedia } from "../../src/domain/sites/PublicMedia.js";
import { Site } from "../../src/domain/sites/Site.js";
import { VoteTally } from "../../src/domain/sites/VoteTally.js";
import { CleanupIntake } from "../../src/services/sites/CleanupIntake.js";
import { CleanupService } from "../../src/services/sites/CleanupService.js";
import { ConflictRetry } from "../../src/services/sites/ConflictRetry.js";
import { SiteFinder } from "../../src/services/sites/SiteFinder.js";
import { acceptPhoto, afterPhoto, BASE_URL, DEVICE_A, DEVICE_B, fixture, northOf, report, userOf } from "./builders.js";
import { FakeCleanups, FakeQueue, FakeVoteRepository, FixedClock } from "./fakes.js";
import { withdrawalRig } from "./withdrawalFakes.js";
import { RULES } from "../defaults.js";

const SITE = "site_jdh_1";
const LATER = "2026-10-10T03:00:00.000Z";
const AFTER_PHOTO = `${BASE_URL}/media/cleanups/cln_x.jpg`;
const requester = (device: string) => ({ userId: userOf(device), deviceToken: device });
const CLEANUP = {
  upload_id: "upl_jdh_3c",
  device_token: DEVICE_B,
  sha256: "a".repeat(64),
  gps: { lat: 26.26185, lon: 73.00352, accuracy_m: 8 },
  captured_at: "2026-10-10T05:55:00Z",
};
const PASSED = {
  moderation: fixture<ModerationResult>("moderation_result.jdh-3.json"),
  verification: fixture<VerificationResult>("verification_result.jdh-3.json"),
};

function soleReporter() {
  const rig = withdrawalRig();
  const founder = report({ device: DEVICE_A });
  rig.rows.add(SITE, founder);
  return { rig, site: Site.found(founder, RULES) };
}

describe("a removed site", () => {
  it("shows neither its photos nor its last after-photo, while the stored row keeps both", async () => {
    const { rig, site } = soleReporter();
    acceptPhoto(site, afterPhoto("cleaner-1", LATER, "cln_x"));
    rig.sites.put(site);
    await rig.service.withdraw(SITE, requester(DEVICE_A));
    const shown = validateSite(await new SiteFinder(rig.sites, new NgeohashCells(), new FixedClock()).byId(SITE)).properties;
    expect(shown).toMatchObject({ status: "removed", photo_urls: [], cleanup_photo_url: null });
    expect(rig.sites.feature(SITE).properties.cleanup_photo_url).toBe(AFTER_PHOTO);
  });

  it("finishes a cleanup still checking as rejected instead of failing it on every retry", async () => {
    const { rig, site } = soleReporter();
    rig.sites.put(site);
    const cleanups = new FakeCleanups();
    const retry = new ConflictRetry();
    await new CleanupIntake({ sites: rig.sites, cleanups, queue: new FakeQueue(), clock: new FixedClock(), retry }).submit(SITE, CLEANUP, null);
    await rig.service.withdraw(SITE, requester(DEVICE_A));
    const service = new CleanupService({ sites: rig.sites, cleanups, votes: new FakeVoteRepository(), media: new PublicMedia(BASE_URL), retry });
    expect(await service.apply("cln_jdh_3c", PASSED)).toBe("rejected");
    expect(cleanups.records.get("cln_jdh_3c")?.status).toBe("rejected");
    expect(rig.sites.feature(SITE).properties.status).toBe("removed");
  });

  it("keeps its verification and backers when votes are recounted, and forgets the withdrawn reporter", async () => {
    const { rig, site } = soleReporter();
    rig.sites.put(site);
    await rig.service.withdraw(SITE, requester(DEVICE_A));
    const removed = await rig.sites.get(SITE);
    const before = rig.sites.feature(SITE).properties;
    const noVotes = ["n1", "n2", "n3", "n4", "n5"].map((device) => ({ siteId: SITE, deviceToken: device, userId: null, choice: "reject" as const, votedAt: LATER }));
    removed?.recordVotes(VoteTally.of(noVotes));
    const after = removed?.snapshot().feature.properties;
    expect(after).toMatchObject({ status: "removed", verification: before.verification, backers: before.backers });
    expect(rig.sites.internals(SITE)).toMatchObject({ reporterIds: [], reporterUsers: [], reporterDevices: [] });
  });
});

describe("withdrawing while a site report has no row in the by-site index yet", () => {
  it("keeps that report's possible reporter, brands and dates instead of dropping them", async () => {
    const rig = withdrawalRig();
    const founder = report({ device: DEVICE_A });
    const unindexed = { ...report({ id: "jdh_1b", device: DEVICE_B, lat: northOf(10), capturedAt: LATER }), brands: [] };
    const site = Site.found(founder, RULES);
    site.merge(unindexed);
    rig.rows.add(SITE, founder);
    rig.sites.put(site);
    const before = rig.sites.feature(SITE).properties;
    const result = await rig.service.withdraw(SITE, requester(DEVICE_A));
    expect(result).toMatchObject({ withdrawn_report_ids: ["rpt_jdh_1"], site_removed: false });
    const after = validateSite(rig.sites.feature(SITE)).properties;
    expect(after).toMatchObject({ report_count: 1, brands: before.brands, first_reported_at: before.first_reported_at, last_reported_at: LATER });
    expect(after.photo_urls).toEqual([`${BASE_URL}/media/reports/rpt_jdh_1b.jpg`]);
    expect(rig.sites.internals(SITE)?.reporterIds).toEqual([userOf(DEVICE_A), userOf(DEVICE_B)]);
    expect(rig.sites.internals(SITE)?.reports.map((each) => each.reportId)).toEqual(["rpt_jdh_1b"]);
  });

  it("ignores index rows that are not reports of this site", async () => {
    const rig = withdrawalRig();
    const founder = report({ device: DEVICE_A });
    rig.sites.put(Site.found(founder, RULES));
    rig.rows.add(SITE, report({ id: "jdh_stray", device: DEVICE_A }));
    await expect(rig.service.withdraw(SITE, requester(DEVICE_A))).rejects.toMatchObject({ status: 404 });
  });
});
