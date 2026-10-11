import type { S3Client } from "@aws-sdk/client-s3";
import type { SQSClient } from "@aws-sdk/client-sqs";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it } from "vitest";
import { AwsCalls } from "../../src/adapters/sites/AwsCalls.js";
import { NgeohashCells } from "../../src/adapters/sites/NgeohashCells.js";
import { S3EmbeddingStore } from "../../src/adapters/sites/S3EmbeddingStore.js";
import { SiteItemMapper } from "../../src/adapters/sites/SiteItemMapper.js";
import { SqsCleanupQueue } from "../../src/adapters/sites/SqsCleanupQueue.js";
import type { ModerationResult, VerificationResult } from "../../src/contracts/index.gen.js";
import { ExternalServiceError, InternalDataError, NotFoundError } from "../../src/domain/errors.js";
import { EmbeddingVector } from "../../src/domain/sites/EmbeddingVector.js";
import { Site } from "../../src/domain/sites/Site.js";
import { SiteServiceFactory } from "../../src/handlers/sites/SiteServiceFactory.js";
import { SitesSettings } from "../../src/settings/SitesSettings.js";
import { DEVICE_B, evidence, fixture, report } from "./builders.js";
import { RecordingLogger } from "./fakes.js";
import { failure, ScriptedClient, type SentCommand } from "./ScriptedClient.js";
import { SITES_ENV } from "./sitesEnv.js";
import { RULES } from "../defaults.js";

const calls = new AwsCalls();

describe("AwsCalls", () => {
  it("passes our own errors through and wraps SDK failures", async () => {
    const ours = new NotFoundError("No site");
    await expect(calls.run("x", () => Promise.reject(ours))).rejects.toBe(ours);
    await expect(calls.run("S3 get", failure("AccessDenied"))).rejects.toThrow(ExternalServiceError);
    await expect(calls.conditional("put", failure("AccessDenied"))).rejects.toThrow(/put failed/);
  });
});

describe("S3EmbeddingStore", () => {
  const body = (value: object) => () => ({ Body: { transformToString: async () => JSON.stringify(value) } });

  it("reads the stored vector and refuses a size mismatch", async () => {
    const stored = { model: "amazon.titan-embed-image-v1", dim: 3, vector: [1, 0, 0] };
    const client = new ScriptedClient([body(stored), body({ ...stored, dim: 4 })]);
    const store = new S3EmbeddingStore(client.as<S3Client>(), "junksnap-dev-originals-1", calls);
    const vector = await store.vectorAt("embeddings/rpt_jdh_1.json");
    expect(vector.cosine(new EmbeddingVector([1, 0, 0]))).toBeCloseTo(1);
    expect(client.sent[0]?.input).toEqual({ Bucket: "junksnap-dev-originals-1", Key: "embeddings/rpt_jdh_1.json" });
    await expect(store.vectorAt("embeddings/rpt_jdh_1.json")).rejects.toThrow(InternalDataError);
  });
});

describe("SqsCleanupQueue", () => {
  const record = {
    cleanup_id: "cln_jdh_3c",
    site_id: "site_jdh_3",
    upload_id: "upl_jdh_3c",
    device_token: DEVICE_B,
    user_id: "user-1",
    sha256: "c".repeat(64),
    gps: { lat: 26.2701, lon: 73.0458, accuracy_m: 8 },
    captured_at: "2026-10-09T06:20:00Z",
    received_at: "2026-10-09T06:20:30Z",
    status: "checking" as const,
  };

  it("sends the cleanup message from contracts/README.md, without user_id for a guest", async () => {
    const client = new ScriptedClient();
    const queue = new SqsCleanupQueue(client.as<SQSClient>(), "https://sqs.example/queue", calls);
    await queue.send(record);
    await queue.send({ ...record, user_id: null });
    const { status, ...fields } = record;
    expect(status).toBe("checking");
    expect(JSON.parse(String(client.sent[0]?.input.MessageBody))).toEqual({ kind: "cleanup", ...fields });
    expect(JSON.parse(String(client.sent[1]?.input.MessageBody))).not.toHaveProperty("user_id");
  });
});

describe("SiteServiceFactory", () => {
  function factory(answer: (command: SentCommand) => unknown) {
    const dynamo = new ScriptedClient([], answer);
    const clients = {
      dynamo: dynamo.as<DynamoDBDocumentClient>(),
      s3: new ScriptedClient().as<S3Client>(),
      sqs: new ScriptedClient().as<SQSClient>(),
    };
    return { dynamo, built: new SiteServiceFactory(SitesSettings.fromEnv(SITES_ENV), clients, new RecordingLogger()) };
  }
  const tableOf = (command: SentCommand) => `${command.name} ${String(command.input.TableName)}`;

  it("builds a merger wired to the sites, scores and reports tables", async () => {
    const { dynamo, built } = factory((command) => (command.name === "QueryCommand" ? { Items: [] } : {}));
    expect(await built.merger().merge(evidence())).toMatchObject({ siteId: "site_jdh_1", outcome: "founded" });
    const sent = dynamo.sent.map(tableOf);
    expect(sent).toContain("QueryCommand junksnap-dev-sites");
    expect(sent.filter((line) => line === "PutCommand junksnap-dev-scores")).toHaveLength(3);
    expect(sent).toContain("PutCommand junksnap-dev-sites");
    expect(sent).toContain("UpdateCommand junksnap-dev-reports");
  });

  it("builds a cleanup service wired to the cleanups and sites tables", async () => {
    const site = Site.found(report(), RULES);
    site.startCleanup("cln_jdh_3c", new Date("2026-10-10T06:00:00Z"));
    const siteItem = new SiteItemMapper(new NgeohashCells(), new RecordingLogger(), RULES).toItem(site);
    const record = { cleanup_id: "cln_jdh_3c", site_id: "site_jdh_1", upload_id: "upl_jdh_3c", device_token: DEVICE_B };
    const stored = { ...record, sha256: "c".repeat(64), gps: { lat: 1, lon: 1, accuracy_m: 1 }, captured_at: "t", received_at: "2026-10-10T06:00:00.000Z", status: "checking" };
    const { dynamo, built } = factory((command) => {
      if (command.name !== "GetCommand") {
        return {};
      }
      return { Item: command.input.TableName === "junksnap-dev-cleanups" ? stored : siteItem };
    });
    const outcome = {
      moderation: fixture<ModerationResult>("moderation_result.jdh-3.json"),
      verification: fixture<VerificationResult>("verification_result.jdh-3.json"),
    };
    expect(await built.cleanupService().apply("cln_jdh_3c", outcome)).toBe("accepted");
    expect(dynamo.sent.map(tableOf)).toEqual([
      "GetCommand junksnap-dev-cleanups",
      "GetCommand junksnap-dev-sites",
      "QueryCommand junksnap-dev-votes",
      "PutCommand junksnap-dev-sites",
      "UpdateCommand junksnap-dev-cleanups",
    ]);
    // One after-photo is one person's word (decision 20261010-1855): the site waits for two more.
    expect(dynamo.sent[3]?.input.Item).toMatchObject({ status: "open", cleanup_status: "pending_confirmation", clearance: { count: 1, needed: 3 } });
  });
});
