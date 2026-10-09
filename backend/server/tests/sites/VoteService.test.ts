import { describe, expect, it } from "vitest";
import { GeoPoint } from "../../src/domain/sites/GeoPoint.js";
import { Site } from "../../src/domain/sites/Site.js";
import { OwnSiteError, SiteNotFoundError, TooFarError } from "../../src/domain/sites/SiteErrors.js";
import { ConflictRetry } from "../../src/services/sites/ConflictRetry.js";
import { VoteService, type Ballot } from "../../src/services/sites/VoteService.js";
import { BASE_LAT, BASE_LON, DEVICE_A, DEVICE_B, DEVICE_C, DEVICE_D, northOf, report, userOf } from "./builders.js";
import { FakeReportStatus, FakeReputation, FakeSiteRepository, FakeVoteRepository, FixedClock, NOW } from "./fakes.js";

const NEARBY = new GeoPoint(northOf(200), BASE_LON);
const DEVICE_E = "0f0e0d0c-0b0a-4908-8706-050403020100";

function ballot(deviceToken: string, choice: Ballot["choice"] = "confirm", point = NEARBY): Ballot {
  return { deviceToken, userId: userOf(deviceToken), choice, point };
}

function setup(reputations: Record<string, number> = {}, decision: "auto_verified" | "community_check" = "community_check") {
  const sites = new FakeSiteRepository();
  sites.put(Site.found(report({ decision })));
  const votes = new FakeVoteRepository();
  const reports = new FakeReportStatus();
  const service = new VoteService({
    sites,
    votes,
    reputation: new FakeReputation(reputations),
    reports,
    clock: new FixedClock(),
    retry: new ConflictRetry(),
  });
  return { sites, votes, reports, service };
}

describe("VoteService", () => {
  it("records a weighted vote with its user and returns the vote result", async () => {
    const { service, votes } = setup({ [DEVICE_B]: 0.74, [userOf(DEVICE_B)]: 0.9 });
    const result = await service.cast("site_jdh_1", ballot(DEVICE_B));
    expect(result).toEqual({ site_id: "site_jdh_1", votes: { confirm: 1, reject: 0 }, verification: "community_check" });
    expect(await votes.forSite("site_jdh_1")).toEqual([
      { siteId: "site_jdh_1", deviceToken: DEVICE_B, userId: userOf(DEVICE_B), choice: "confirm", weight: 1.24, votedAt: NOW },
    ]);
  });

  it("weighs a vote by the lower of the user's and the device's reputation", async () => {
    const { service, votes } = setup({ [DEVICE_B]: 1, [userOf(DEVICE_B)]: 0.2 });
    await service.cast("site_jdh_1", ballot(DEVICE_B));
    expect((await votes.forSite("site_jdh_1"))[0]?.weight).toBeCloseTo(0.7);
  });

  it("verifies at +3 and moves the merged reports with the site", async () => {
    const { service, reports, sites } = setup();
    await service.cast("site_jdh_1", ballot(DEVICE_B));
    await service.cast("site_jdh_1", ballot(DEVICE_C));
    const result = await service.cast("site_jdh_1", ballot(DEVICE_D));
    expect(result.verification).toBe("verified");
    expect(reports.statuses.get("rpt_jdh_1")).toBe("verified");
    expect(sites.feature("site_jdh_1").properties).toMatchObject({ corroborations: 3, verified_count: 1 });
  });

  it("counts one user on two phones once", async () => {
    const { service } = setup();
    await service.cast("site_jdh_1", ballot(DEVICE_B));
    await service.cast("site_jdh_1", { ...ballot(DEVICE_C), userId: userOf(DEVICE_B) });
    const result = await service.cast("site_jdh_1", ballot(DEVICE_D));
    expect(result).toMatchObject({ votes: { confirm: 2, reject: 0 }, verification: "community_check" });
  });

  it("rejects at -3, counting high-reputation voters more", async () => {
    const { service, reports } = setup({ [DEVICE_B]: 1, [DEVICE_C]: 1, [userOf(DEVICE_B)]: 1, [userOf(DEVICE_C)]: 1 });
    expect((await service.cast("site_jdh_1", ballot(DEVICE_B, "reject"))).verification).toBe("community_check");
    expect((await service.cast("site_jdh_1", ballot(DEVICE_C, "reject"))).verification).toBe("rejected");
    expect(reports.statuses.get("rpt_jdh_1")).toBe("rejected");
  });

  it("counts only a device's latest vote", async () => {
    const { service } = setup();
    await service.cast("site_jdh_1", ballot(DEVICE_B, "reject"));
    const result = await service.cast("site_jdh_1", ballot(DEVICE_B, "confirm"));
    expect(result.votes).toEqual({ confirm: 1, reject: 0 });
  });

  it("never changes a settled site, but still counts the votes and rewrites the statuses", async () => {
    const { service, reports } = setup({}, "auto_verified");
    for (const device of [DEVICE_B, DEVICE_C, DEVICE_D]) {
      await service.cast("site_jdh_1", ballot(device, "reject"));
    }
    const result = await service.cast("site_jdh_1", ballot(DEVICE_E, "reject"));
    expect(result).toEqual({ site_id: "site_jdh_1", votes: { confirm: 0, reject: 4 }, verification: "verified" });
    expect(reports.calls).toBe(4);
    expect(reports.statuses.get("rpt_jdh_1")).toBe("verified");
  });

  it("repairs the statuses on the next vote after a failed status write", async () => {
    const { service, reports } = setup();
    await service.cast("site_jdh_1", ballot(DEVICE_B));
    await service.cast("site_jdh_1", ballot(DEVICE_C));
    reports.failNext();
    await expect(service.cast("site_jdh_1", ballot(DEVICE_D))).rejects.toThrow(/unreachable/);
    expect(reports.statuses.size).toBe(0);
    expect((await service.cast("site_jdh_1", ballot(DEVICE_D))).verification).toBe("verified");
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

  it("re-reads and settles again after another writer saved the site first", async () => {
    const { service, sites } = setup();
    sites.failNextSaves(2);
    expect((await service.cast("site_jdh_1", ballot(DEVICE_B))).votes.confirm).toBe(1);
    expect(sites.saves).toBe(1);
  });
});
