import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it } from "vitest";
import { AwsCalls } from "../../src/adapters/sites/AwsCalls.js";
import { DynamoAreaScoreSeeder } from "../../src/adapters/sites/DynamoAreaScoreSeeder.js";
import { DynamoCleanupRepository } from "../../src/adapters/sites/DynamoCleanupRepository.js";
import { DynamoReportStatusWriter } from "../../src/adapters/sites/DynamoReportStatusWriter.js";
import { DynamoSiteRepository } from "../../src/adapters/sites/DynamoSiteRepository.js";
import { DynamoVoteRepository } from "../../src/adapters/sites/DynamoVoteRepository.js";
import { DynamoVoterReputation } from "../../src/adapters/sites/DynamoVoterReputation.js";
import { NgeohashCells } from "../../src/adapters/sites/NgeohashCells.js";
import { SiteItemMapper } from "../../src/adapters/sites/SiteItemMapper.js";
import type { WardScores } from "../../src/contracts/index.gen.js";
import { ExternalServiceError, InternalDataError } from "../../src/domain/errors.js";
import type { CleanupRecord } from "../../src/domain/sites/Cleanup.js";
import { Site } from "../../src/domain/sites/Site.js";
import { StaleSiteError } from "../../src/domain/sites/SiteErrors.js";
import { DEVICE_B, fixture, report, userOf } from "./builders.js";
import { FixedClock, RecordingLogger } from "./fakes.js";
import { conditionFailed, failure, ScriptedClient } from "./ScriptedClient.js";

const calls = new AwsCalls();
const throttled = failure("ProvisionedThroughputExceededException");
const dynamo = (client: ScriptedClient) => client.as<DynamoDBDocumentClient>();
const RECORD: CleanupRecord = {
  cleanup_id: "cln_jdh_3c",
  site_id: "site_jdh_3",
  upload_id: "upl_jdh_3c",
  device_token: DEVICE_B,
  user_id: null,
  sha256: "c".repeat(64),
  gps: { lat: 26.2701, lon: 73.0458, accuracy_m: 8 },
  captured_at: "2026-10-09T06:20:00Z",
  received_at: "2026-10-09T06:20:30Z",
  status: "checking",
};

function siteRepository(client: ScriptedClient, logger = new RecordingLogger()) {
  const mapper = new SiteItemMapper(new NgeohashCells(), logger);
  return { mapper, logger, sites: new DynamoSiteRepository(dynamo(client), "junksnap-dev-sites", mapper, calls) };
}

describe("DynamoSiteRepository", () => {
  it("queries the by-geohash index page by page, skipping and logging a bad item", async () => {
    const { mapper } = siteRepository(new ScriptedClient());
    const first = mapper.toItem(Site.found(report()));
    const second = mapper.toItem(Site.found(report({ id: "jdh_2" })));
    const client = new ScriptedClient([
      () => ({ Items: [first, { ...second, site_id: "site_bad", status: "gone" }], LastEvaluatedKey: { site_id: "x" } }),
      () => ({ Items: [second] }),
    ]);
    const { sites, logger } = siteRepository(client);
    expect((await sites.inCell("tsjv")).map((site) => site.siteId)).toEqual(["site_jdh_1", "site_jdh_2"]);
    expect(client.sent[0]?.input).toMatchObject({ IndexName: "by-geohash", ExpressionAttributeValues: { ":cell": "tsjv" } });
    expect(client.sent[1]?.input.ExclusiveStartKey).toEqual({ site_id: "x" });
    expect(logger.lines).toEqual([expect.objectContaining({ level: "warn", fields: expect.objectContaining({ site_id: "site_bad" }) })]);
  });

  it("saves only over the version it read, writing the next one", async () => {
    const { mapper } = siteRepository(new ScriptedClient());
    const stored = mapper.toSite(mapper.toItem(Site.found(report())));
    const client = new ScriptedClient([() => ({}), conditionFailed]);
    const { sites } = siteRepository(client);
    await sites.save(stored);
    expect(client.sent[0]?.input).toMatchObject({
      ConditionExpression: "version = :expected",
      ExpressionAttributeValues: { ":expected": 1 },
      Item: { version: 2, site_id: "site_jdh_1", geohash4: new NgeohashCells().cellOf(stored.point) },
    });
    await expect(sites.save(stored)).rejects.toThrow(StaleSiteError);
  });

  it("saves an item from before versioning only while it still has no version", async () => {
    const { mapper } = siteRepository(new ScriptedClient());
    const { version: _old, ...older } = mapper.toItem(Site.found(report()));
    expect(_old).toBe(1);
    const client = new ScriptedClient();
    await siteRepository(client).sites.save(mapper.toSite(older));
    expect(client.sent[0]?.input).toMatchObject({ ConditionExpression: "attribute_not_exists(version)", Item: { version: 1 } });
  });

  it("reports an existing id on create and wraps other failures", async () => {
    const client = new ScriptedClient([conditionFailed, throttled]);
    const { sites } = siteRepository(client);
    expect(await sites.create(Site.found(report()))).toBe(false);
    expect(client.sent[0]?.input.ConditionExpression).toBe("attribute_not_exists(site_id)");
    await expect(sites.get("site_jdh_1")).rejects.toThrow(ExternalServiceError);
  });
});

describe("DynamoVoteRepository", () => {
  const item = { site_id: "site_jdh_1", device_token: DEVICE_B, vote: "confirm", weight: 1.2, voted_at: "2026-10-10T05:00:00Z" };

  it("stores the user only when there is one and reads votes back", async () => {
    const client = new ScriptedClient([
      () => ({}),
      () => ({}),
      () => ({ Items: [{ ...item, user_id: "user-1" }, item] }),
      () => ({ Items: [{ ...item, vote: "maybe" }] }),
    ]);
    const votes = new DynamoVoteRepository(dynamo(client), "junksnap-dev-votes", calls);
    const vote = { siteId: "site_jdh_1", deviceToken: DEVICE_B, userId: "user-1", choice: "confirm" as const, weight: 1.2, votedAt: "t" };
    await votes.put(vote);
    await votes.put({ ...vote, userId: null });
    expect(client.sent[0]?.input.Item).toMatchObject({ user_id: "user-1" });
    expect(client.sent[1]?.input.Item).not.toHaveProperty("user_id");
    expect((await votes.forSite("site_jdh_1")).map((read) => read.userId)).toEqual(["user-1", null]);
    expect(client.sent[2]?.input.ConsistentRead).toBe(true);
    await expect(votes.forSite("site_jdh_1")).rejects.toThrow(InternalDataError);
  });
});

describe("DynamoVoterReputation", () => {
  it("takes the lower of the user's and the device's reputation, 0.5 when unknown", async () => {
    const byTable = (command: { input: Record<string, unknown> }) =>
      command.input.TableName === "users" ? { Item: { reputation: 0.3 } } : { Item: { reputation: 0.8 } };
    const client = new ScriptedClient([], byTable);
    const reputation = new DynamoVoterReputation(dynamo(client), { devices: "devices", users: "users" }, calls);
    expect(await reputation.reputationOf({ deviceToken: DEVICE_B, userId: userOf(DEVICE_B) })).toBe(0.3);
    expect(await reputation.reputationOf({ deviceToken: DEVICE_B, userId: null })).toBe(0.5);
    expect(client.sent.at(-1)?.input).toMatchObject({ TableName: "devices", Key: { device_token: DEVICE_B } });
    const unknown = new ScriptedClient([], () => ({ Item: { reputation: "high" } }));
    const fresh = new DynamoVoterReputation(dynamo(unknown), { devices: "devices", users: "users" }, calls);
    expect(await fresh.reputationOf({ deviceToken: DEVICE_B, userId: "user-1" })).toBe(0.5);
  });
});

describe("DynamoReportStatusWriter", () => {
  it("writes each report only when its status differs, and swallows the refusals", async () => {
    const client = new ScriptedClient([() => ({}), conditionFailed]);
    const writer = new DynamoReportStatusWriter(dynamo(client), "junksnap-dev-reports", new FixedClock(), calls);
    await writer.followSite(["rpt_a", "rpt_b"], "verified");
    expect(client.sent).toHaveLength(2);
    expect(client.sent[0]?.input).toMatchObject({
      Key: { report_id: "rpt_a" },
      ConditionExpression: "#status IN (:verified, :community_check) AND #status <> :status",
      ExpressionAttributeValues: { ":status": "verified", ":verified": "verified", ":community_check": "community_check" },
    });
  });

  it("bumps the report's version so the worker's optimistic lock sees the write", async () => {
    const client = new ScriptedClient();
    await new DynamoReportStatusWriter(dynamo(client), "r", new FixedClock(), calls).followSite(["rpt_a"], "verified");
    expect(client.sent[0]?.input).toMatchObject({
      UpdateExpression: "SET #status = :status, updated_at = :updated ADD #version :one",
      ExpressionAttributeNames: { "#status": "status", "#version": "version" },
      ExpressionAttributeValues: { ":one": 1 },
    });
  });

  it("passes other failures on", async () => {
    const writer = new DynamoReportStatusWriter(dynamo(new ScriptedClient([throttled])), "r", new FixedClock(), calls);
    await expect(writer.followSite(["rpt_a"], "verified")).rejects.toThrow(ExternalServiceError);
  });
});

describe("DynamoAreaScoreSeeder", () => {
  it("puts the row under its area key only when none exists, swallowing the refusal", async () => {
    const row = fixture<WardScores>("ward_scores.jpr-1.json");
    const client = new ScriptedClient([conditionFailed, throttled]);
    const seeder = new DynamoAreaScoreSeeder(dynamo(client), "junksnap-dev-scores", calls);
    await seeder.seedIfMissing(row);
    expect(client.sent[0]?.input).toMatchObject({
      ConditionExpression: "attribute_not_exists(area_kind)",
      Item: { area_kind: "assembly", area_id: "s20-ac-54", counts: row.counts },
    });
    await expect(seeder.seedIfMissing(row)).rejects.toThrow(ExternalServiceError);
  });
});

describe("DynamoCleanupRepository", () => {
  it("creates once, leaving out a guest's user, and swallows the repeat", async () => {
    const client = new ScriptedClient([() => ({}), conditionFailed, () => ({})]);
    const cleanups = new DynamoCleanupRepository(dynamo(client), "junksnap-dev-cleanups", calls);
    await cleanups.create(RECORD);
    await cleanups.create(RECORD);
    await cleanups.create({ ...RECORD, user_id: "user-1" });
    expect(client.sent[0]?.input).toMatchObject({ ConditionExpression: "attribute_not_exists(cleanup_id)" });
    expect(client.sent[0]?.input.Item).not.toHaveProperty("user_id");
    expect(client.sent[2]?.input.Item).toMatchObject({ user_id: "user-1" });
  });

  it("finishes only a record that is still checking, swallowing the refusal", async () => {
    const client = new ScriptedClient([conditionFailed, throttled]);
    const cleanups = new DynamoCleanupRepository(dynamo(client), "junksnap-dev-cleanups", calls);
    await cleanups.finish("cln_jdh_3c", { status: "rejected", moderation: null, verification: null });
    expect(client.sent[0]?.input).toMatchObject({
      ConditionExpression: "#status = :checking",
      ExpressionAttributeValues: { ":status": "rejected", ":checking": "checking", ":moderation": null },
    });
    await expect(cleanups.finish("cln_jdh_3c", { status: "rejected", moderation: null, verification: null })).rejects.toThrow(
      ExternalServiceError,
    );
  });

  it("reads a record, a guest's as user null, and refuses a malformed one", async () => {
    const { user_id: _guest, ...stored } = RECORD;
    expect(_guest).toBeNull();
    const client = new ScriptedClient([() => ({ Item: stored }), () => ({}), () => ({ Item: { ...stored, status: "odd" } })]);
    const cleanups = new DynamoCleanupRepository(dynamo(client), "junksnap-dev-cleanups", calls);
    expect(await cleanups.get("cln_jdh_3c")).toEqual(RECORD);
    expect(await cleanups.get("cln_jdh_3c")).toBeNull();
    await expect(cleanups.get("cln_jdh_3c")).rejects.toThrow(InternalDataError);
  });
});
