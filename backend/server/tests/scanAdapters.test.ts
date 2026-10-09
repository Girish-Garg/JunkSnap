import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { NoSuchKey, S3Client } from "@aws-sdk/client-s3";
import type { SQSClient } from "@aws-sdk/client-sqs";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { afterEach, describe, expect, it } from "vitest";
import { DynamoFrameReportRepository } from "../src/adapters/DynamoFrameReportRepository.js";
import { DynamoScanRepository } from "../src/adapters/DynamoScanRepository.js";
import { S3ScanMediaStore } from "../src/adapters/S3ScanMediaStore.js";
import { S3ScanUploadSigner } from "../src/adapters/S3ScanUploadSigner.js";
import { SqsScanQueue } from "../src/adapters/SqsScanQueue.js";
import type { ScanFrameUpload } from "../src/contracts/scanSessionPending.js";
import { ExternalServiceError } from "../src/domain/errors.js";
import { InvalidVideoError } from "../src/domain/scanErrors.js";
import { queuedRecord } from "./scanFakes.js";

// Records each command's input and answers with whatever the test queued up.
class FakeAwsClient {
  readonly inputs: Record<string, unknown>[] = [];
  readonly #replies: (() => unknown)[] = [];

  reply(answer: () => unknown): this {
    this.#replies.push(answer);
    return this;
  }

  async send(command: { input: Record<string, unknown> }): Promise<unknown> {
    this.inputs.push(command.input);
    return (this.#replies.shift() ?? (() => ({})))();
  }

  as<T>(): T {
    return this as unknown as T;
  }
}

const conditionFailed = () => {
  throw new ConditionalCheckFailedException({ message: "exists", $metadata: {} });
};

let dir: string | undefined;

afterEach(async () => {
  if (dir !== undefined) {
    await rm(dir, { recursive: true, force: true });
    dir = undefined;
  }
});

describe("S3ScanUploadSigner", () => {
  it("signs content type, length and checksum into a private PUT URL without any network call", async () => {
    const credentials = { accessKeyId: "AKIDEXAMPLE", secretAccessKey: "not-a-secret" };
    const client = new S3Client({ region: "ap-south-1", credentials, requestChecksumCalculation: "WHEN_REQUIRED" });
    const signer = new S3ScanUploadSigner(client, "junksnap-dev-originals-123456789012", 300);
    const sha256Hex = "58a6b635872943aba34889e6e3c9fc117067b42f79f064042afe57d7e2046f18";
    const signed = await signer.sign({ key: "scans/scn_x.webm", contentType: "video/webm", sha256Hex, sizeBytes: 9_400_000 });
    const url = new URL(signed.url);
    expect(url.pathname).toContain("scans/scn_x.webm");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("content-length;content-type;host;x-amz-checksum-sha256");
    const checksum = Buffer.from(sha256Hex, "hex").toString("base64");
    expect(signed.headers).toEqual({ "Content-Type": "video/webm", "x-amz-checksum-sha256": checksum });
  });
});

describe("S3ScanMediaStore", () => {
  it("streams the video to disk and returns its size and SHA-256", async () => {
    dir = await mkdtemp(join(tmpdir(), "junksnap-adapter-test-"));
    const bytes = Buffer.from("pretend this is a webm");
    const s3 = new FakeAwsClient().reply(() => ({ Body: Readable.from([bytes.subarray(0, 5), bytes.subarray(5)]) }));
    const store = new S3ScanMediaStore(s3.as<S3Client>(), "originals");
    const video = await store.downloadVideo("scans/scn_x.webm", join(dir, "video.webm"));
    expect(video).toEqual({ bytes: bytes.length, sha256Hex: createHash("sha256").update(bytes).digest("hex") });
    expect(await readFile(join(dir, "video.webm"))).toEqual(bytes);
    expect(s3.inputs).toEqual([{ Bucket: "originals", Key: "scans/scn_x.webm" }]);
  });

  it("turns a missing object into InvalidVideoError and other failures into ExternalServiceError", async () => {
    const missing = new FakeAwsClient().reply(() => {
      throw new NoSuchKey({ message: "gone", $metadata: {} });
    });
    await expect(new S3ScanMediaStore(missing.as<S3Client>(), "b").downloadVideo("k", "p")).rejects.toThrow(InvalidVideoError);
    const down = new FakeAwsClient().reply(() => {
      throw new Error("timeout");
    });
    await expect(new S3ScanMediaStore(down.as<S3Client>(), "b").downloadVideo("k", "p")).rejects.toThrow(ExternalServiceError);
  });

  it("stores a frame original as a private JPEG with its checksum", async () => {
    const s3 = new FakeAwsClient();
    const jpeg = Buffer.from([0xff, 0xd8, 0xff]);
    await new S3ScanMediaStore(s3.as<S3Client>(), "originals").putOriginal("reports/upl_a.jpg", jpeg, "ab".repeat(32));
    expect(s3.inputs[0]).toMatchObject({ Bucket: "originals", Key: "reports/upl_a.jpg", ContentType: "image/jpeg" });
    expect(s3.inputs[0]?.ChecksumSHA256).toBe(Buffer.from("ab".repeat(32), "hex").toString("base64"));
  });
});

describe("DynamoScanRepository", () => {
  it("creates a scan only when the id is new", async () => {
    const dynamo = new FakeAwsClient().reply(() => ({})).reply(conditionFailed);
    const scans = new DynamoScanRepository(dynamo.as<DynamoDBDocumentClient>(), "junksnap-dev-scans");
    expect(await scans.create(queuedRecord())).toBe(true);
    expect(await scans.create(queuedRecord())).toBe(false);
    expect(dynamo.inputs[0]).toMatchObject({ TableName: "junksnap-dev-scans", ConditionExpression: "attribute_not_exists(scan_id)" });
  });

  it("updates named fields with placeholders, since status is a reserved word", async () => {
    const dynamo = new FakeAwsClient();
    const scans = new DynamoScanRepository(dynamo.as<DynamoDBDocumentClient>(), "t");
    await scans.update("scn_x", { status: "failed", reason: "invalid_video", updated_at: "2026-10-10T04:03:00Z" });
    expect(dynamo.inputs[0]).toMatchObject({
      Key: { scan_id: "scn_x" },
      UpdateExpression: "SET #f0 = :v0, #f1 = :v1, #f2 = :v2",
      ExpressionAttributeNames: { "#f0": "status", "#f1": "reason", "#f2": "updated_at" },
      ExpressionAttributeValues: { ":v0": "failed", ":v1": "invalid_video", ":v2": "2026-10-10T04:03:00Z" },
    });
  });

  it("returns undefined for an unknown scan and wraps SDK failures", async () => {
    const dynamo = new FakeAwsClient().reply(() => ({})).reply(() => {
      throw new Error("throttled");
    });
    const scans = new DynamoScanRepository(dynamo.as<DynamoDBDocumentClient>(), "t");
    expect(await scans.find("scn_none")).toBeUndefined();
    await expect(scans.find("scn_none")).rejects.toThrow(ExternalServiceError);
  });
});

describe("DynamoFrameReportRepository", () => {
  it("writes a queued report row once and leaves an existing one alone", async () => {
    const dynamo = new FakeAwsClient().reply(() => ({})).reply(conditionFailed).reply(() => ({ Item: { report_id: "rpt_a" } }));
    const reports = new DynamoFrameReportRepository(dynamo.as<DynamoDBDocumentClient>(), "junksnap-dev-reports");
    const upload: ScanFrameUpload = {
      upload_id: "upl_a",
      report_type: "waste_dump",
      context: "roadside",
      capture_mode: "scan",
      scan: { scan_id: "scn_x", t_ms: 0 },
      sha256: "a".repeat(64),
      gps: { lat: 26.2918, lon: 73.0213, accuracy_m: 6 },
      device_token: "a71e5c90-2d3b-4f86-b1c4-9e0d27f58a63",
      captured_at: "2026-10-10T04:02:06.000Z",
    };
    const report = { report_id: "rpt_a", upload, received_at: "2026-10-10T04:03:00Z" };
    await reports.createQueued(report);
    await expect(reports.createQueued(report)).resolves.toBeUndefined();
    expect(await reports.exists("rpt_a")).toBe(true);
    expect(dynamo.inputs[0]).toMatchObject({
      Item: { report_id: "rpt_a", upload_id: "upl_a", status: "queued", received_at: "2026-10-10T04:03:00Z" },
      ConditionExpression: "attribute_not_exists(report_id)",
    });
  });
});

describe("SqsScanQueue", () => {
  it("sends kind scan and kind report messages to the reports queue", async () => {
    const sqs = new FakeAwsClient();
    const queue = new SqsScanQueue(sqs.as<SQSClient>(), "https://sqs.example/junksnap-dev-reports");
    await queue.sendScan("scn_x");
    await queue.sendReport("rpt_y");
    expect(sqs.inputs).toEqual([
      { QueueUrl: "https://sqs.example/junksnap-dev-reports", MessageBody: '{"kind":"scan","scan_id":"scn_x"}' },
      { QueueUrl: "https://sqs.example/junksnap-dev-reports", MessageBody: '{"kind":"report","report_id":"rpt_y"}' },
    ]);
  });
});
