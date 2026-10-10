import { describe, expect, it } from "vitest";
import { NgeohashCells } from "../../src/adapters/sites/NgeohashCells.js";
import { SiteItemParser } from "../../src/adapters/SiteItemParser.js";
import { validateSite } from "../../src/contracts/index.gen.js";
import { AreaSites } from "../../src/domain/AreaSites.js";
import { NotFoundError } from "../../src/domain/errors.js";
import { RateLimitedError } from "../../src/domain/letters/errors.js";
import { BoundingBox } from "../../src/domain/sites/BoundingBox.js";
import { GeoPoint } from "../../src/domain/sites/GeoPoint.js";
import type { MergeableReport } from "../../src/domain/sites/MergeableReport.js";
import { Site } from "../../src/domain/sites/Site.js";
import { SiteRemovedError, SiteVerifiedError } from "../../src/domain/sites/SiteErrors.js";
import { VoteTally } from "../../src/domain/sites/VoteTally.js";
import { SiteFinder } from "../../src/services/sites/SiteFinder.js";
import { afterPhoto, BASE_LAT, BASE_LON, BASE_URL, DEVICE_A, DEVICE_B, DEVICE_C, NO_VOTES, northOf, report, siteFixture, userOf } from "./builders.js";
import { FixedClock } from "./fakes.js";
import { withdrawalRig, type WithdrawalRig } from "./withdrawalFakes.js";

const SITE = "site_jdh_1";
const LATER = "2026-10-10T03:00:00Z";
const AROUND = BoundingBox.parse(`${BASE_LON - 0.01},${BASE_LAT - 0.01},${BASE_LON + 0.01},${BASE_LAT + 0.01}`);
const requester = (device: string) => ({ userId: userOf(device), deviceToken: device });

// Founds site_jdh_1 from DEVICE_A's photo and merges one more photo per extra report.
function seeded(rig: WithdrawalRig, extra: readonly MergeableReport[] = []): Site {
  const founder = report({ device: DEVICE_A });
  const site = Site.found(founder);
  rig.rows.add(SITE, founder);
  for (const added of extra) {
    site.merge(added);
    rig.rows.add(SITE, added);
  }
  rig.sites.put(site);
  return site;
}

// A second person's photo 10 m north, later in the day, with no readable label.
function neighbour(device = DEVICE_B, id = "jdh_1b"): MergeableReport {
  return { ...report({ id, device, lat: northOf(10), capturedAt: LATER }), brands: [] };
}

describe("withdrawing the only report", () => {
  it("removes the site from the map, keeps it for the audit trail and marks the report withdrawn", async () => {
    const rig = withdrawalRig();
    seeded(rig);
    const result = await rig.service.withdraw(SITE, requester(DEVICE_A));
    expect(result).toMatchObject({ site_id: SITE, withdrawn_report_ids: ["rpt_jdh_1"], site_removed: true, status: "removed" });
    const stored = validateSite(rig.sites.feature(SITE)).properties;
    expect(stored).toMatchObject({ status: "removed", removed_reason: "withdrawn", removed_at: "2026-10-10T06:00:00.000Z", report_count: 1 });
    expect(rig.sites.internals(SITE)).toMatchObject({ reports: [], withdrawnReports: ["rpt_jdh_1"] });
    expect(rig.withdrawer.withdrawn.get("rpt_jdh_1")).toBe("2026-10-10T06:00:00.000Z");
    expect(await new SiteFinder(rig.sites, new NgeohashCells(), new FixedClock()).inBox(AROUND)).toEqual([]);
    expect((await new SiteFinder(rig.sites, new NgeohashCells(), new FixedClock()).byId(SITE)).properties.photo_urls).toEqual([]);
    expect(stored.photo_urls).toEqual([`${BASE_URL}/media/reports/rpt_jdh_1.jpg`]);
  });

  it("answers a retried call the same way without saving again", async () => {
    const rig = withdrawalRig();
    seeded(rig);
    await rig.service.withdraw(SITE, requester(DEVICE_A));
    const saves = rig.sites.saves;
    const again = await rig.service.withdraw(SITE, requester(DEVICE_A));
    expect(again).toMatchObject({ withdrawn_report_ids: ["rpt_jdh_1"], site_removed: true });
    expect(rig.sites.saves).toBe(saves);
  });

  it("takes no new photo, vote or cleanup once removed, and a redelivered merge changes nothing", async () => {
    const rig = withdrawalRig();
    seeded(rig);
    await rig.service.withdraw(SITE, requester(DEVICE_A));
    const site = await rig.sites.get(SITE);
    expect(site?.accepts(neighbour())).toBe(false);
    expect(site?.holds("rpt_jdh_1")).toBe(true);
    const at = new Date(LATER);
    expect(() => site?.admitVoter({ deviceToken: DEVICE_C, userId: null }, new GeoPoint(BASE_LAT, BASE_LON), "confirm", at)).toThrow(SiteRemovedError);
    expect(() => site?.startCleanup("cln_x", at)).toThrow(SiteRemovedError);
    expect(() => site?.acceptCleanup(afterPhoto("cleaner-1", LATER, "cln_x"), NO_VOTES)).toThrow(SiteRemovedError);
  });
});

describe("withdrawing when other people back the site", () => {
  it("removes only the caller's report, photo, brand and backing, and keeps a photo site's pin on the waste", async () => {
    const rig = withdrawalRig();
    seeded(rig, [neighbour()]);
    const result = await rig.service.withdraw(SITE, requester(DEVICE_A));
    expect(result).toMatchObject({ withdrawn_report_ids: ["rpt_jdh_1"], site_removed: false, status: "open", verification: "unverified" });
    expect(result.backers).toEqual({ count: 1, needed: 10, photo_people: 1, vote_people: 0 });
    const feature = validateSite(rig.sites.feature(SITE));
    expect(feature.geometry.coordinates).toEqual([BASE_LON, BASE_LAT]);
    expect(feature.properties).toMatchObject({
      report_count: 1,
      reporters: 1,
      photo_urls: [`${BASE_URL}/media/reports/rpt_jdh_1b.jpg`],
      brands: [],
      first_reported_at: LATER,
      last_reported_at: LATER,
    });
    expect(rig.sites.internals(SITE)).toMatchObject({
      reporterDevices: [DEVICE_B],
      reporterUsers: [userOf(DEVICE_B)],
      reporterIds: [userOf(DEVICE_B)],
      withdrawnReports: ["rpt_jdh_1"],
    });
    expect(await new SiteFinder(rig.sites, new NgeohashCells(), new FixedClock()).inBox(AROUND)).toHaveLength(1);
  });

  it("re-centres a no-bin zone on the reports that stay", async () => {
    const rig = withdrawalRig();
    const zone = (id: string, device: string, lat: number) => report({ id, device, lat, reportType: "no_bin", context: "no_bin" });
    const founder = zone("nb_1", DEVICE_A, BASE_LAT);
    const site = Site.found(founder);
    const other = zone("nb_2", DEVICE_B, northOf(200));
    site.merge(other);
    rig.rows.add("site_nb_1", founder);
    rig.rows.add("site_nb_1", other);
    rig.sites.put(site);
    await rig.service.withdraw("site_nb_1", requester(DEVICE_A));
    expect(rig.sites.feature("site_nb_1").geometry.coordinates[1]).toBeCloseTo(northOf(200), 6);
  });

  it("lets the no-vote valve reject the site once the caller's backing is gone", async () => {
    const rig = withdrawalRig();
    const site = seeded(rig, [neighbour()]);
    const noVotes = [DEVICE_C, "d1", "d2", "d3"].map((device) => ({ siteId: SITE, deviceToken: device, userId: null, choice: "reject" as const, votedAt: LATER }));
    site.recordVotes(VoteTally.of(noVotes));
    expect(site.verification).toBe("unverified");
    rig.sites.put(site);
    const result = await rig.service.withdraw(SITE, requester(DEVICE_A));
    expect(result.verification).toBe("rejected");
    expect(rig.statuses.statuses.get("rpt_jdh_1b")).toBe("rejected");
  });
});

describe("refusals", () => {
  it("refuses with 409 site_verified once ten people verified the site", async () => {
    const rig = withdrawalRig();
    const site = seeded(rig);
    const yes = Array.from({ length: 9 }, (_, n) => ({ siteId: SITE, deviceToken: `y${n}`, userId: null, choice: "confirm" as const, votedAt: LATER }));
    site.recordVotes(VoteTally.of(yes));
    rig.sites.put(site);
    const refusal = rig.service.withdraw(SITE, requester(DEVICE_A));
    await expect(refusal).rejects.toThrow(SiteVerifiedError);
    await expect(refusal).rejects.toMatchObject({ code: "site_verified", status: 409 });
    expect(rig.withdrawer.withdrawn.size).toBe(0);
  });

  it("answers 404 to someone with no report on the site, and to an unknown site", async () => {
    const rig = withdrawalRig();
    seeded(rig, [neighbour()]);
    await expect(rig.service.withdraw(SITE, requester(DEVICE_C))).rejects.toThrow(NotFoundError);
    await expect(rig.service.withdraw("site_none", requester(DEVICE_A))).rejects.toMatchObject({ status: 404 });
    expect(validateSite(rig.sites.feature(SITE)).properties.report_count).toBe(2);
  });

  it("rate limits withdrawals per user and device", async () => {
    const rig = withdrawalRig(undefined, 1);
    seeded(rig, [neighbour(), neighbour(DEVICE_C, "jdh_1c")]);
    await rig.service.withdraw(SITE, requester(DEVICE_B));
    const second = rig.service.withdraw(SITE, { userId: userOf(DEVICE_C), deviceToken: DEVICE_B });
    await expect(second).rejects.toThrow(RateLimitedError);
  });
});

describe("scores after removal", () => {
  it("leave a removed site out of every area count and never call it cleared", () => {
    const item = { ...siteFixture("jdh-5").properties, lat: 26.2934, lon: 73.0312 };
    const removed = new SiteItemParser().parse(item);
    expect(removed.isCounted()).toBe(false);
    expect(removed.everCleared()).toBe(false);
    const open = new SiteItemParser().parse({ ...siteFixture("jdh-1").properties, lat: 26.26, lon: 73.0 });
    expect(new AreaSites([removed, open]).counts()).toMatchObject({ sites: 1, open_sites: 1, cleaned_sites: 0 });
  });
});
