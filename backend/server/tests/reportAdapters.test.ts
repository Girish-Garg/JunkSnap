import { S3Client } from "@aws-sdk/client-s3";
import type { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import type { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it } from "vitest";
import { DynamoReportRepository } from "../src/adapters/DynamoReportRepository.js";
import { DynamoReputationReader } from "../src/adapters/DynamoReputationReader.js";
import { DynamoSnapCounter } from "../src/adapters/DynamoSnapCounter.js";
import { HttpMlVerifyClient, type FetchFunction } from "../src/adapters/HttpMlVerifyClient.js";
import { S3UploadSigner } from "../src/adapters/S3UploadSigner.js";
import { SqsReportQueue } from "../src/adapters/SqsReportQueue.js";
import { ConcurrentUpdateError } from "../src/domain/ConcurrentUpdateError.js";
import { ConfigError, ExternalServiceError, InternalDataError } from "../src/domain/errors.js";
import { Report } from "../src/domain/Report.js";
import type { VerifyRequest } from "../src/domain/VerifyRequest.js";
import { IntakeSettings } from "../src/settings/IntakeSettings.js";
import { upload, verification } from "./reportFakes.js";
import { TIMEOUTS } from "./defaults.js";

const conditionFailed = () => Object.assign(new Error("The conditional request failed"), { name: "ConditionalCheckFailedException" });

// Replays scripted results for each send and records the commands.
class ScriptedClient {
  readonly commands: object[] = [];

  constructor(readonly results: (object | Error)[]) {}

  async send(command: object): Promise<object> {
    this.commands.push(command);
    const next = this.results.shift() ?? {};
    return next instanceof Error ? Promise.reject(next) : next;
  }

  documents(): DynamoDBDocumentClient {
    return this as unknown as DynamoDBDocumentClient;
  }
}

describe("S3UploadSigner", () => {
  it("signs the checksum and content type as headers on the regional bucket host", async () => {
    const credentials = { accessKeyId: "AKIDEXAMPLE", secretAccessKey: "secret" };
    const signer = new S3UploadSigner(new S3Client({ region: "ap-south-1", credentials }), "junksnap-dev-originals-1");
    const url = new URL(
      await signer.sign({ key: "reports/upl_x.jpg", contentType: "image/jpeg", checksumBase64: "qg==", expiresInSeconds: 300 }),
    );
    expect(url.host).toBe("junksnap-dev-originals-1.s3.ap-south-1.amazonaws.com");
    expect(url.pathname).toBe("/reports/upl_x.jpg");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("content-type;host;x-amz-checksum-sha256");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.has("x-amz-checksum-sha256")).toBe(false);
  });
});

describe("DynamoSnapCounter", () => {
  const since = "2026-10-10T01:14:52Z";

  it("counts snaps on by-device over received_at, paging to the end", async () => {
    const client = new ScriptedClient([{ Count: 15, LastEvaluatedKey: { report_id: "rpt_a" } }, { Count: 4 }]);
    expect(await new DynamoSnapCounter(client.documents(), "reports").byDevice("dev-1", since)).toBe(19);
    const [first, second] = client.commands as QueryCommand[];
    expect(first?.input).toMatchObject({
      TableName: "reports",
      IndexName: "by-device",
      KeyConditionExpression: "#key = :key AND received_at > :since",
      FilterExpression: "capture_mode = :snap",
      ExpressionAttributeNames: { "#key": "device_token" },
      ExpressionAttributeValues: { ":key": "dev-1", ":since": since, ":snap": "snap" },
      Select: "COUNT",
    });
    expect(second?.input.ExclusiveStartKey).toEqual({ report_id: "rpt_a" });
  });

  it("counts a user's snaps on by-user", async () => {
    const client = new ScriptedClient([{ Count: 2 }]);
    expect(await new DynamoSnapCounter(client.documents(), "reports").byUser("user-1", since)).toBe(2);
    expect((client.commands[0] as QueryCommand).input).toMatchObject({
      IndexName: "by-user",
      ExpressionAttributeNames: { "#key": "user_id" },
    });
  });

  it("turns DynamoDB errors into ExternalServiceError", async () => {
    const client = new ScriptedClient([new Error("ProvisionedThroughputExceeded")]);
    await expect(new DynamoSnapCounter(client.documents(), "reports").byDevice("dev-1", since)).rejects.toThrow(
      ExternalServiceError,
    );
  });
});

describe("DynamoReputationReader", () => {
  const tables = { devices: "devices", users: "users" };

  it("reads devices and users, 0.5 when never seen", async () => {
    const client = new ScriptedClient([{}, { Item: { reputation: 0.74 } }]);
    const reader = new DynamoReputationReader(client.documents(), tables);
    expect(await reader.ofDevice("dev-1")).toBe(0.5);
    expect(await reader.ofUser("user-1")).toBe(0.74);
    const [device, user] = client.commands as GetCommand[];
    expect(device?.input).toMatchObject({ TableName: "devices", Key: { device_token: "dev-1" } });
    expect(user?.input).toMatchObject({ TableName: "users", Key: { user_id: "user-1" } });
  });

  it("refuses a stored reputation outside 0 to 1", async () => {
    const client = new ScriptedClient([{ Item: { reputation: 7 } }]);
    await expect(new DynamoReputationReader(client.documents(), tables).ofDevice("dev-1")).rejects.toThrow(
      InternalDataError,
    );
  });
});

describe("DynamoReportRepository", () => {
  const report = () => Report.receive(upload(), "2026-10-10T02:14:52Z");

  it("creates only when the id is new", async () => {
    const client = new ScriptedClient([{}, conditionFailed()]);
    const repository = new DynamoReportRepository(client.documents(), "reports");
    expect(await repository.create(report())).toBe(true);
    expect(await repository.create(report())).toBe(false);
    const put = client.commands[0] as PutCommand;
    expect(put.input).toMatchObject({ TableName: "reports", ConditionExpression: "attribute_not_exists(report_id)" });
    expect(put.input.Item).toMatchObject({ report_id: "rpt_jdh_1", device_token: upload().device_token, version: 1 });
  });

  it("saves version + 1 only while the stored version is the one read", async () => {
    const client = new ScriptedClient([{}, {}]);
    const repository = new DynamoReportRepository(client.documents(), "reports");
    const stored = Report.fromRecord({ ...report().toRecord(), version: 4 });
    await repository.save(stored);
    await repository.save(stored);
    const [first, second] = client.commands as PutCommand[];
    expect(first?.input).toMatchObject({
      ConditionExpression: "#version = :expected",
      ExpressionAttributeNames: { "#version": "version" },
      ExpressionAttributeValues: { ":expected": 4 },
      Item: { version: 5 },
    });
    expect(second?.input).toMatchObject({ ExpressionAttributeValues: { ":expected": 5 }, Item: { version: 6 } });
  });

  it("saves an item written before versions existed only if it still has none", async () => {
    const client = new ScriptedClient([{}]);
    await new DynamoReportRepository(client.documents(), "reports").save(report());
    expect((client.commands[0] as PutCommand).input).toMatchObject({
      ConditionExpression: "attribute_not_exists(#version)",
      Item: { version: 1 },
    });
  });

  it("throws ConcurrentUpdateError when another writer saved first", async () => {
    const client = new ScriptedClient([conditionFailed()]);
    const repository = new DynamoReportRepository(client.documents(), "reports");
    await expect(repository.save(report())).rejects.toThrow(ConcurrentUpdateError);
  });

  it("reads a stored report and rejects a malformed item", async () => {
    const client = new ScriptedClient([{ Item: report().toRecord() }, {}, { Item: { report_id: "rpt_x" } }]);
    const repository = new DynamoReportRepository(client.documents(), "reports");
    expect((await repository.get("rpt_jdh_1"))?.status).toBe("queued");
    expect(await repository.get("rpt_none")).toBeUndefined();
    await expect(repository.get("rpt_x")).rejects.toThrow(InternalDataError);
  });

  it("turns write failures into ExternalServiceError", async () => {
    const client = new ScriptedClient([new Error("AccessDenied"), new Error("AccessDenied")]);
    const repository = new DynamoReportRepository(client.documents(), "reports");
    await expect(repository.create(report())).rejects.toThrow(ExternalServiceError);
    await expect(repository.save(report())).rejects.toThrow(ExternalServiceError);
  });
});

describe("SqsReportQueue", () => {
  it("sends a report message", async () => {
    const client = new ScriptedClient([{}]);
    await new SqsReportQueue(client as unknown as SQSClient, "https://queue").sendReport("rpt_jdh_1");
    const [command] = client.commands as SendMessageCommand[];
    expect(command?.input).toEqual({ QueueUrl: "https://queue", MessageBody: '{"kind":"report","report_id":"rpt_jdh_1"}' });
  });
});

describe("HttpMlVerifyClient", () => {
  const request: VerifyRequest = Report.receive(upload(), "2026-10-10T02:14:52Z").verifyRequest({
    reputation: 0.74,
    nearby_verified_reports: 5,
  });

  function client(answer: () => Promise<Response>) {
    const calls: [string, RequestInit | undefined][] = [];
    const fetchFunction: FetchFunction = async (url, init) => {
      calls.push([String(url), init]);
      return answer();
    };
    return { calls, verifier: new HttpMlVerifyClient("http://ml/", TIMEOUTS.mlVerifyMs, fetchFunction) };
  }

  it("posts the verify request with only the blurred key and returns the result", async () => {
    const { calls, verifier } = client(async () => Response.json(verification()));
    expect(await verifier.verify(request)).toEqual(verification());
    expect(calls[0]?.[0]).toBe("http://ml/internal/verify");
    const body = JSON.parse(String(calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(body).toEqual(request);
    expect(body.blurred_key).toBe("media/reports/rpt_jdh_1.jpg");
    expect(JSON.stringify(body)).not.toContain("upl_");
  });

  it.each([
    ["an HTTP error", async () => new Response("down", { status: 503 }), ExternalServiceError],
    ["a network failure", async () => Promise.reject(new TypeError("fetch failed")), ExternalServiceError],
    ["a body that is not JSON", async () => new Response("<html>"), InternalDataError],
    ["a body outside the contract", async () => Response.json({ report_id: "rpt_jdh_1" }), InternalDataError],
    ["a result for another photo", async () => Response.json({ ...verification(), report_id: "rpt_other" }), InternalDataError],
  ])("fails on %s", async (_case, answer, error) => {
    await expect(client(answer).verifier.verify(request)).rejects.toThrow(error);
  });
});

describe("IntakeSettings", () => {
  const env = {
    REPORTS_TABLE: "junksnap-dev-reports",
    ORIGINALS_BUCKET: "junksnap-dev-originals-1",
    REPORTS_QUEUE_URL: "https://sqs.ap-south-1.amazonaws.com/1/junksnap-dev-reports",
    PUBLIC_BASE_URL: "https://d111111abcdef8.cloudfront.net/",
  };

  it("reads the contract variable names, defaults the TTL and drops a trailing slash", () => {
    const settings = IntakeSettings.fromEnv(env);
    expect(settings).toMatchObject({ presignTtlSeconds: 300, publicBaseUrl: "https://d111111abcdef8.cloudfront.net" });
    expect(IntakeSettings.fromEnv({ ...env, PRESIGN_TTL_SECONDS: "60" }).presignTtlSeconds).toBe(60);
  });

  it("names what is missing", () => {
    expect(() => IntakeSettings.fromEnv({ ...env, ORIGINALS_BUCKET: undefined })).toThrow(ConfigError);
    expect(() => IntakeSettings.fromEnv({ ...env, ORIGINALS_BUCKET: undefined })).toThrow(/ORIGINALS_BUCKET/);
  });
});
