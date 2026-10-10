import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it } from "vitest";
import { AwsCalls } from "../../src/adapters/sites/AwsCalls.js";
import { DynamoSiteRepository } from "../../src/adapters/sites/DynamoSiteRepository.js";
import { NgeohashCells } from "../../src/adapters/sites/NgeohashCells.js";
import { SiteItemMapper } from "../../src/adapters/sites/SiteItemMapper.js";
import { SiteItemParser } from "../../src/adapters/SiteItemParser.js";
import { Site } from "../../src/domain/sites/Site.js";
import { BackerMigration } from "../../src/services/sites/BackerMigration.js";
import { ConflictRetry } from "../../src/services/sites/ConflictRetry.js";
import { report, siteFixture } from "./builders.js";
import { FakeReportStatus, FakeSiteRepository, FakeVoteRepository, NOW, RecordingLogger } from "./fakes.js";
import { ScriptedClient } from "./ScriptedClient.js";

function oldVerifiedSite(id: string, photos: number): Site {
  const site = Site.found(report({ id: `${id}_0`, device: `${id}-dev-0`, user: `${id}-user-0` }));
  for (let n = 1; n < photos; n += 1) {
    site.merge(report({ id: `${id}_${n}`, device: `${id}-dev-${n}`, user: `${id}-user-${n}` }));
  }
  const { feature, internals } = site.snapshot();
  const reports = internals.reports.map((merged) => ({ ...merged, verified: true }));
  const properties = { ...feature.properties, verification: "verified" as const, verified_count: photos };
  return Site.restore({ feature: { ...feature, properties }, internals: { ...internals, reports } });
}

function voteOn(votes: FakeVoteRepository, siteId: string) {
  return (n: number, userId: string | null) =>
    votes.put({ siteId, deviceToken: `${siteId}-voter-${n}`, userId, choice: "confirm", votedAt: NOW });
}

describe("BackerMigration", () => {
  it("recounts every site from its stored photos and votes, and moves the reports", async () => {
    const sites = new FakeSiteRepository();
    const votes = new FakeVoteRepository();
    const reports = new FakeReportStatus();
    sites.put(oldVerifiedSite("site_a", 2));
    sites.put(oldVerifiedSite("site_b", 4));
    for (let n = 0; n < 6; n += 1) {
      await voteOn(votes, "site_site_b_0")(n, n < 2 ? "same-user" : null);
    }
    await voteOn(votes, "site_site_b_0")(9, "site_b-user-1");
    const migration = new BackerMigration({ sites, votes, reports, retry: new ConflictRetry() });
    expect(await migration.run()).toEqual({ sites: 2, verified: 0, rejected: 0 });
    expect(sites.feature("site_site_a_0").properties).toMatchObject({
      verification: "unverified",
      verified_count: 0,
      backers: { count: 2, photo_people: 2, vote_people: 0 },
    });
    expect(sites.feature("site_site_b_0").properties.backers).toEqual({ count: 9, needed: 10, photo_people: 4, vote_people: 6 });
    expect(reports.statuses.get("rpt_site_a_0")).toBe("unverified");
  });

  it("verifies a site that already has ten backers, and is safe to run twice", async () => {
    const sites = new FakeSiteRepository();
    const votes = new FakeVoteRepository();
    sites.put(oldVerifiedSite("site_c", 3));
    for (let n = 0; n < 7; n += 1) {
      await voteOn(votes, "site_site_c_0")(n, null);
    }
    const migration = new BackerMigration({ sites, votes, reports: new FakeReportStatus(), retry: new ConflictRetry() });
    await migration.run();
    expect(await migration.run()).toEqual({ sites: 1, verified: 1, rejected: 0 });
    expect(sites.feature("site_site_c_0").properties).toMatchObject({ verification: "verified", verified_count: 3 });
  });
});

describe("older site items", () => {
  const feature = siteFixture("jpr-1");
  const [lon, lat] = feature.geometry.coordinates;
  const { backers: _gone, ...props } = feature.properties;
  const legacy = { ...props, verification: "community_check", lat, lon, report_ids: ["rpt_jpr_1"], reporter_ids: ["u1"] };

  it("read community_check as unverified with the photo people as provisional backers", () => {
    expect(_gone).toBeDefined();
    const site = new SiteItemMapper(new NgeohashCells(), new RecordingLogger()).toSite(legacy);
    expect(site.toFeature().properties).toMatchObject({
      verification: "unverified",
      backers: { count: 1, needed: 10, photo_people: 1, vote_people: 0 },
    });
    expect(new SiteItemParser().parse(legacy).isVerified()).toBe(false);
  });

  it("are listed by the id scan, page by page", async () => {
    const client = new ScriptedClient([
      () => ({ Items: [{ site_id: "site_a" }], LastEvaluatedKey: { site_id: "site_a" } }),
      () => ({ Items: [{ site_id: "site_b" }] }),
    ]);
    const mapper = new SiteItemMapper(new NgeohashCells(), new RecordingLogger());
    const repository = new DynamoSiteRepository(client.as<DynamoDBDocumentClient>(), "sites", mapper, new AwsCalls());
    expect(await repository.allIds()).toEqual(["site_a", "site_b"]);
    expect(client.sent[1]?.input).toMatchObject({ ProjectionExpression: "site_id", ExclusiveStartKey: { site_id: "site_a" } });
  });
});
