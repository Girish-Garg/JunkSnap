import { describe, expect, it } from "vitest";
import { GeoPoint } from "../../src/domain/sites/GeoPoint.js";
import { Site } from "../../src/domain/sites/Site.js";
import { OwnSiteError, SiteNotFoundError, SiteRejectedError, TooFarError } from "../../src/domain/sites/SiteErrors.js";
import { ConflictRetry } from "../../src/services/sites/ConflictRetry.js";
import { VoteService, type Ballot } from "../../src/services/sites/VoteService.js";
import { BASE_LAT, BASE_LON, DEVICE_A, DEVICE_B, northOf, report, userOf } from "./builders.js";
import { FakeReportStatus, FakeSiteRepository, FakeVoteRepository, FixedClock, NOW } from "./fakes.js";

const NEARBY = new GeoPoint(northOf(200), BASE_LON);

function ballot(deviceToken: string, choice: Ballot["choice"] = "confirm", point = NEARBY): Ballot {
  return { deviceToken, userId: userOf(deviceToken), choice, point };
}

function voter(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

function setup() {
  const sites = new FakeSiteRepository();
  sites.put(Site.found(report()));
  const votes = new FakeVoteRepository();
  const reports = new FakeReportStatus();
  const service = new VoteService({ sites, votes, reports, clock: new FixedClock(), retry: new ConflictRetry() });
  return { sites, votes, reports, service };
}

async function castMany(service: VoteService, from: number, count: number, choice: Ballot["choice"] = "confirm") {
  let last;
  for (let n = from; n < from + count; n += 1) {
    last = await service.cast("site_jdh_1", { ...ballot(voter(n), choice), userId: `voter-${n}` });
  }
  return last;
}

describe("VoteService", () => {
  it("records a vote with its user and returns the counts and backers", async () => {
    const { service, votes, reports } = setup();
    const result = await service.cast("site_jdh_1", ballot(DEVICE_B));
    expect(result).toEqual({
      site_id: "site_jdh_1",
      votes: { confirm: 1, reject: 0, cleaned: 0 },
      backers: { count: 2, needed: 10, photo_people: 1, vote_people: 1 },
      verification: "unverified",
    });
    expect(await votes.forSite("site_jdh_1")).toEqual([
      { siteId: "site_jdh_1", deviceToken: DEVICE_B, userId: userOf(DEVICE_B), choice: "confirm", votedAt: NOW },
    ]);
    expect(reports.statuses.get("rpt_jdh_1")).toBe("unverified");
  });

  it("verifies at the tenth backer and moves the merged reports with the site", async () => {
    const { service, reports, sites } = setup();
    expect((await castMany(service, 1, 8))?.verification).toBe("unverified");
    const result = await castMany(service, 9, 1);
    expect(result).toMatchObject({ verification: "verified", backers: { count: 10 } });
    expect(reports.statuses.get("rpt_jdh_1")).toBe("verified");
    expect(sites.feature("site_jdh_1").properties).toMatchObject({ verified_count: 1, corroborations: 9 });
  });

  it("counts one user on two phones once", async () => {
    const { service } = setup();
    await service.cast("site_jdh_1", ballot(DEVICE_B));
    const result = await service.cast("site_jdh_1", { ...ballot(voter(1)), userId: userOf(DEVICE_B) });
    expect(result.backers).toMatchObject({ count: 2, vote_people: 1 });
  });

  it("counts guests by device", async () => {
    const { service } = setup();
    await service.cast("site_jdh_1", { ...ballot(voter(1)), userId: null });
    const result = await service.cast("site_jdh_1", { ...ballot(voter(2)), userId: null });
    expect(result.backers).toMatchObject({ count: 3, vote_people: 2 });
  });

  it("rejects when no voters lead the backers by 3, and hides nothing else", async () => {
    const { service, reports } = setup();
    expect((await castMany(service, 1, 3, "reject"))?.verification).toBe("unverified");
    expect((await castMany(service, 4, 1, "reject"))?.verification).toBe("rejected");
    expect(reports.statuses.get("rpt_jdh_1")).toBe("rejected");
  });

  it("refuses votes on a rejected site with 409 site_rejected", async () => {
    const { service, votes } = setup();
    await castMany(service, 1, 4, "reject");
    await expect(castMany(service, 5, 1)).rejects.toThrow(SiteRejectedError);
    expect(await votes.forSite("site_jdh_1")).toHaveLength(4);
    expect(new SiteRejectedError("x")).toMatchObject({ status: 409, code: "site_rejected" });
  });

  it("counts only a device's latest vote", async () => {
    const { service } = setup();
    await service.cast("site_jdh_1", ballot(DEVICE_B, "reject"));
    const result = await service.cast("site_jdh_1", ballot(DEVICE_B, "confirm"));
    expect(result.votes).toEqual({ confirm: 1, reject: 0, cleaned: 0 });
  });

  it("repairs the statuses on the next vote after a failed status write", async () => {
    const { service, reports } = setup();
    await castMany(service, 1, 8);
    reports.failNext();
    await expect(castMany(service, 9, 1)).rejects.toThrow(/unreachable/);
    expect(reports.statuses.get("rpt_jdh_1")).toBe("unverified");
    expect((await castMany(service, 10, 1))?.verification).toBe("verified");
    expect(reports.statuses.get("rpt_jdh_1")).toBe("verified");
  });

  it("refuses the reporter's device or user with own_site even from far away", async () => {
    const { service } = setup();
    const far = new GeoPoint(BASE_LAT + 1, BASE_LON);
    await expect(service.cast("site_jdh_1", ballot(DEVICE_A, "confirm", far))).rejects.toThrow(OwnSiteError);
    const sameUser = { ...ballot(DEVICE_B, "confirm", far), userId: userOf(DEVICE_A) };
    await expect(service.cast("site_jdh_1", sameUser)).rejects.toThrow(OwnSiteError);
  });

  it("refuses voters more than 1 km away", async () => {
    const { service, votes } = setup();
    const far = new GeoPoint(northOf(1010), BASE_LON);
    await expect(service.cast("site_jdh_1", ballot(DEVICE_B, "confirm", far))).rejects.toThrow(TooFarError);
    expect(await votes.forSite("site_jdh_1")).toEqual([]);
  });

  it("returns not_found for an unknown site", async () => {
    const { service } = setup();
    await expect(service.cast("site_nope", ballot(DEVICE_B))).rejects.toThrow(SiteNotFoundError);
  });

  it("re-reads and counts again after another writer saved the site first", async () => {
    const { service, sites } = setup();
    sites.failNextSaves(2);
    expect((await service.cast("site_jdh_1", ballot(DEVICE_B))).votes.confirm).toBe(1);
    expect(sites.saves).toBe(1);
  });
});
