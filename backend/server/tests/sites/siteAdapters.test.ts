import type { S3Client } from "@aws-sdk/client-s3";
import type { SQSClient } from "@aws-sdk/client-sqs";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it } from "vitest";
import { DynamoDeviceReputation } from "../../src/adapters/sites/DynamoDeviceReputation.js";
import { DynamoSiteRepository } from "../../src/adapters/sites/DynamoSiteRepository.js";
import { DynamoVoteRepository } from "../../src/adapters/sites/DynamoVoteRepository.js";
import { NgeohashCells } from "../../src/adapters/sites/NgeohashCells.js";
import { S3EmbeddingStore } from "../../src/adapters/sites/S3EmbeddingStore.js";
import { SiteItemMapper } from "../../src/adapters/sites/SiteItemMapper.js";
import { SqsCleanupQueue } from "../../src/adapters/sites/SqsCleanupQueue.js";
import { ExternalServiceError, InternalDataError } from "../../src/domain/errors.js";
import { EmbeddingVector } from "../../src/domain/sites/EmbeddingVector.js";
import { Site } from "../../src/domain/sites/Site.js";
import { StaleSiteError } from "../../src/domain/sites/SiteErrors.js";
import { DEVICE_B, report } from "./builders.js";

interface SentCommand {
  readonly name: string;
  readonly input: Record<string, unknown>;
}

// Stands in for an AWS SDK client: records each command and answers from a script.
class ScriptedClient {
  readonly sent: SentCommand[] = [];
  readonly #answers: (() => unknown)[];

  constructor(...answers: (() => unknown)[]) {
    this.#answers = answers;
  }

  async send(command: { input: Record<string, unknown> }): Promise<unknown> {
    this.sent.push({ name: command.constructor.name, input: command.input });
    const answer = this.#answers.shift();
    return answer === undefined ? {} : answer();
  }

  as<T>(): T {
    return this as unknown as T;
  }
}

const conditionFailed = () => {
  throw Object.assign(new Error("The conditional request failed"), { name: "ConditionalCheckFailedException" });
};
const mapper = new SiteItemMapper(new NgeohashCells());

function repository(client: ScriptedClient): DynamoSiteRepository {
  return new DynamoSiteRepository(client.as<DynamoDBDocumentClient>(), "junksnap-dev-sites", mapper);
}

describe("DynamoSiteRepository", () => {
  it("queries the by-geohash index page by page", async () => {
    const first = mapper.toItem(Site.found(report()));
    const second = mapper.toItem(Site.found(report({ id: "jdh_2" })));
    const client = new ScriptedClient(
      () => ({ Items: [first], LastEvaluatedKey: { site_id: "site_jdh_1" } }),
      () => ({ Items: [second] }),
    );
    const sites = await repository(client).inCell("tsjv");
    expect(sites.map((site) => site.siteId)).toEqual(["site_jdh_1", "site_jdh_2"]);
    expect(client.sent[0]?.input).toMatchObject({ IndexName: "by-geohash", ExpressionAttributeValues: { ":cell": "tsjv" } });
    expect(client.sent[1]?.input.ExclusiveStartKey).toEqual({ site_id: "site_jdh_1" });
  });

  it("saves only over the version it read, writing the next one", async () => {
    const stored = mapper.toSite(mapper.toItem(Site.found(report())));
    const client = new ScriptedClient(() => ({}), conditionFailed);
    await repository(client).save(stored);
    expect(client.sent[0]?.input).toMatchObject({
      ConditionExpression: "version = :expected",
      ExpressionAttributeValues: { ":expected": 1 },
      Item: { version: 2, site_id: "site_jdh_1", geohash4: new NgeohashCells().cellOf(stored.point) },
    });
    await expect(repository(client).save(stored)).rejects.toThrow(StaleSiteError);
  });

  it("reports an existing id on create and wraps other failures", async () => {
    const throttled = () => {
      throw Object.assign(new Error("slow down"), { name: "ProvisionedThroughputExceededException" });
    };
    const client = new ScriptedClient(conditionFailed, throttled);
    expect(await repository(client).create(Site.found(report()))).toBe(false);
    await expect(repository(client).get("site_jdh_1")).rejects.toThrow(ExternalServiceError);
  });
});

describe("DynamoVoteRepository and DynamoDeviceReputation", () => {
  it("maps stored votes and refuses malformed ones", async () => {
    const item = { site_id: "site_jdh_1", device_token: DEVICE_B, vote: "confirm", weight: 1.2, voted_at: "2026-10-10T05:00:00Z" };
    const client = new ScriptedClient(() => ({ Items: [item] }), () => ({ Items: [{ ...item, vote: "maybe" }] }));
    const votes = new DynamoVoteRepository(client.as<DynamoDBDocumentClient>(), "junksnap-dev-votes");
    expect(await votes.forSite("site_jdh_1")).toEqual([
      { siteId: "site_jdh_1", deviceToken: DEVICE_B, choice: "confirm", weight: 1.2, votedAt: "2026-10-10T05:00:00Z" },
    ]);
    expect(client.sent[0]?.input.ConsistentRead).toBe(true);
    await expect(votes.forSite("site_jdh_1")).rejects.toThrow(InternalDataError);
  });

  it("gives an unknown or broken device the new-device reputation", async () => {
    const client = new ScriptedClient(() => ({ Item: { reputation: 0.8 } }), () => ({}), () => ({ Item: { reputation: "high" } }));
    const devices = new DynamoDeviceReputation(client.as<DynamoDBDocumentClient>(), "junksnap-dev-devices");
    expect(await devices.reputationOf(DEVICE_B)).toBe(0.8);
    expect(await devices.reputationOf(DEVICE_B)).toBe(0.5);
    expect(await devices.reputationOf(DEVICE_B)).toBe(0.5);
  });
});

describe("S3EmbeddingStore", () => {
  const body = (value: object) => () => ({ Body: { transformToString: async () => JSON.stringify(value) } });

  it("reads the stored vector and refuses a size mismatch", async () => {
    const stored = { model: "amazon.titan-embed-image-v1", dim: 3, vector: [1, 0, 0] };
    const client = new ScriptedClient(body(stored), body({ ...stored, dim: 4 }));
    const store = new S3EmbeddingStore(client.as<S3Client>(), "junksnap-dev-originals-1");
    const vector = await store.vectorAt("embeddings/rpt_jdh_1.json");
    expect(vector.cosine(new EmbeddingVector([1, 0, 0]))).toBeCloseTo(1);
    expect(client.sent[0]?.input).toEqual({ Bucket: "junksnap-dev-originals-1", Key: "embeddings/rpt_jdh_1.json" });
    await expect(store.vectorAt("embeddings/rpt_jdh_1.json")).rejects.toThrow(InternalDataError);
  });
});

describe("SqsCleanupQueue", () => {
  it("sends the cleanup message from contracts/README.md", async () => {
    const client = new ScriptedClient();
    const record = {
      cleanup_id: "cln_jdh_3c",
      site_id: "site_jdh_3",
      upload_id: "upl_jdh_3c",
      device_token: DEVICE_B,
      sha256: "c".repeat(64),
      gps: { lat: 26.2701, lon: 73.0458, accuracy_m: 8 },
      captured_at: "2026-10-09T06:20:00Z",
      received_at: "2026-10-09T06:20:30Z",
      status: "checking" as const,
    };
    await new SqsCleanupQueue(client.as<SQSClient>(), "https://sqs.example/queue").send(record);
    const { status, ...fields } = record;
    expect(status).toBe("checking");
    expect(JSON.parse(String(client.sent[0]?.input.MessageBody))).toEqual({ kind: "cleanup", ...fields });
  });
});
