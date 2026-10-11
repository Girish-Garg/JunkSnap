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
import { DynamoFrameOutcomeReader } from "../src/adapters/DynamoFrameOutcomeReader.js";
import { DynamoFrameReportRepository } from "../src/adapters/DynamoFrameReportRepository.js";
import { DynamoScanRepository } from "../src/adapters/DynamoScanRepository.js";
import { FramecrcParser } from "../src/adapters/FramecrcParser.js";
import { S3ScanMediaStore } from "../src/adapters/S3ScanMediaStore.js";
import { S3ScanUploadSigner } from "../src/adapters/S3ScanUploadSigner.js";
import { SqsScanQueue } from "../src/adapters/SqsScanQueue.js";
import type { ReportUpload } from "../src/contracts/index.gen.js";
import { ExternalServiceError } from "../src/domain/errors.js";
import { InvalidVideoError } from "../src/domain/scanErrors.js";
import { queuedRecord } from "./scanFakes.js";
import { PAGING, RETRY } from "./defaults.js";

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

  it("records frame report ids without touching status, and only while the scan is unfinished", async () => {
    const dynamo = new FakeAwsClient().reply(() => ({})).reply(conditionFailed).reply(() => {
      throw new Error("throttled");
    });
    const scans = new DynamoScanRepository(dynamo.as<DynamoDBDocumentClient>(), "t");
    expect(await scans.recordReports("scn_x", ["rpt_a"], "2026-10-10T04:03:00Z")).toBe(true);
    expect(await scans.recordReports("scn_x", ["rpt_a"], "2026-10-10T04:03:00Z")).toBe(false);
    await expect(scans.recordReports("scn_x", ["rpt_a"], "2026-10-10T04:03:00Z")).rejects.toThrow(ExternalServiceError);
    expect(dynamo.inputs[0]).toEqual({
      TableName: "t",
      Key: { scan_id: "scn_x" },
      UpdateExpression: "SET report_ids = :ids, updated_at = :at",
      ConditionExpression: "attribute_exists(scan_id) AND NOT (#status IN (:done, :failed))",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":ids": ["rpt_a"], ":at": "2026-10-10T04:03:00Z", ":done": "done", ":failed": "failed" },
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
    const upload: ReportUpload = {
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
      Item: { report_id: "rpt_a", upload_id: "upl_a", status: "queued", received_at: "2026-10-10T04:03:00Z", completed_steps: [], version: 1 },
      ConditionExpression: "attribute_not_exists(report_id)",
    });
  });
});

describe("DynamoFrameReportRepository scout rows", () => {
  it("writes the table-only auto_claim and scan_spot attributes when a frame has them", async () => {
    const dynamo = new FakeAwsClient().reply(() => ({}));
    const reports = new DynamoFrameReportRepository(dynamo.as<DynamoDBDocumentClient>(), "junksnap-dev-reports");
    const upload = { upload_id: "upl_b", report_type: "waste_dump", context: "other", capture_mode: "scan" } as ReportUpload;
    await reports.createQueued({ report_id: "rpt_b", upload, received_at: "2026-10-10T04:03:00Z", auto_claim: "type", scan_spot: 0 });
    expect(dynamo.inputs[0]).toMatchObject({ Item: { report_id: "rpt_b", auto_claim: "type", scan_spot: 0, report_type: "waste_dump" } });
  });
});

describe("DynamoFrameOutcomeReader", () => {
  const key = (id: string) => ({ report_id: id });

  it("reads the frame rows in one batch, asking again for unprocessed keys", async () => {
    const dynamo = new FakeAwsClient()
      .reply(() => ({ Responses: { t: [{ report_id: "rpt_a", status: "queued" }] }, UnprocessedKeys: { t: { Keys: [key("rpt_b")] } } }))
      .reply(() => ({ Responses: { t: [{ report_id: "rpt_b", status: "verified" }] } }));
    const reader = new DynamoFrameOutcomeReader(dynamo.as<DynamoDBDocumentClient>(), "t", { size: PAGING.batchGetSize, attempts: RETRY.batchReadAttempts });
    expect(await reader.outcomes(["rpt_a", "rpt_b"])).toEqual([
      { report_id: "rpt_a", status: "queued" },
      { report_id: "rpt_b", status: "verified" },
    ]);
    expect(dynamo.inputs[0]).toMatchObject({ RequestItems: { t: { Keys: [key("rpt_a"), key("rpt_b")] } } });
    expect(dynamo.inputs[1]).toMatchObject({ RequestItems: { t: { Keys: [key("rpt_b")] } } });
  });

  it("asks for nothing without report ids and fails when keys stay unprocessed or the call fails", async () => {
    const stuck = () => ({ UnprocessedKeys: { t: { Keys: [key("rpt_a")] } } });
    const dynamo = new FakeAwsClient().reply(stuck).reply(stuck).reply(stuck).reply(() => {
      throw new Error("throttled");
    });
    const reader = new DynamoFrameOutcomeReader(dynamo.as<DynamoDBDocumentClient>(), "t", { size: PAGING.batchGetSize, attempts: RETRY.batchReadAttempts });
    expect(await reader.outcomes([])).toEqual([]);
    await expect(reader.outcomes(["rpt_a"])).rejects.toThrow(ExternalServiceError);
    await expect(reader.outcomes(["rpt_a"])).rejects.toThrow(ExternalServiceError);
    expect(dynamo.inputs).toHaveLength(4);
  });
});

describe("FramecrcParser", () => {
  const parser = new FramecrcParser();
  const header = "#software: Lavf62\r\n#tb 0: 1/15360\r\n#media_type 0: video\r\n#dimensions 0: 720x1280\r\n";

  it("reads the size and the latest pts, even when packets come out of display order", () => {
    const packets = "0, 0, 1024, 512, 900, 0x1\r\n0, 512, 76800, 512, 900, 0x2, F=0x0\r\n0, 1024, 2048, 512, 900, 0x3\r\n";
    expect(parser.parse(header + packets)).toEqual({ width: 720, height: 1280, lastFrameMs: 5000 });
  });

  // Heads and tails of real listings: headless Chrome MediaRecorder (WebM VP9 with no duration header, and
  // fragmented MP4 with an #extradata line first) and an ffmpeg frag_keyframe+empty_moov MP4 like Android writes.
  it.each([
    [
      "Chrome WebM VP9",
      "#software: Lavf63.1.102\n#tb 0: 1/1000\n#media_type 0: video\n#codec_id 0: vp9\n#dimensions 0: 1280x720\n#sar 0: 1/1\n" +
        "0,          0,          0,        0,   119274, 0xb9e705bc\n0,       9889,       9889,        1,     5924, 0xcae77ab2, F=0x0\n" +
        "0,       9920,       9920,        1,     5660, 0xf8a9e04f, F=0x0\n",
      9920,
    ],
    [
      "Chrome fragmented MP4",
      "#extradata 0:       38, 0x057b0d05\n#software: Lavf63.1.102\n#tb 0: 1/30000\n#media_type 0: video\n#codec_id 0: h264\n" +
        "#dimensions 0: 1280x720\n#sar 0: 1/1\n0,          0,          0,      936,   180904, 0x574d6e15\n" +
        "0,     295942,     295942,      999,     7630, 0xed3d69de, F=0x0\n",
      9864,
    ],
    [
      "Android-style fragmented MP4",
      "#extradata 0:       41, 0x050c0b73\n#software: Lavf63.1.102\n#tb 0: 1/15360\n#media_type 0: video\n#codec_id 0: h264\n" +
        "#dimensions 0: 1280x720\n#sar 0: 0/1\n0,          0,          0,      512,   111496, 0xfd24654d\n" +
        "0,     153088,     153088,      512,     1390, 0xb75e268d, F=0x0\n",
      9966,
    ],
  ])("reads a browser recording: %s", (_case, listing, lastFrameMs) => {
    expect(parser.parse(listing)).toEqual({ width: 1280, height: 720, lastFrameMs });
  });

  it.each([
    ["no packets", header],
    ["no dimensions", "#tb 0: 1/1000\n0, 0, 0, 33, 900, 0x1\n"],
    ["no time base", "#dimensions 0: 320x240\n0, 0, 0, 33, 900, 0x1\n"],
  ])("gives nothing for a listing with %s", (_case, listing) => {
    expect(parser.parse(listing)).toBeUndefined();
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
