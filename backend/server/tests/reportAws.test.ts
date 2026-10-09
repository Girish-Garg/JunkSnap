import { createHash, randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { DynamoReportRepository } from "../src/adapters/DynamoReportRepository.js";
import { DynamoReputationReader } from "../src/adapters/DynamoReputationReader.js";
import { DynamoSnapCounter } from "../src/adapters/DynamoSnapCounter.js";
import { S3UploadSigner } from "../src/adapters/S3UploadSigner.js";
import { UlidIdGenerator } from "../src/adapters/UlidIdGenerator.js";
import { ConcurrentUpdateError } from "../src/domain/ConcurrentUpdateError.js";
import { Report } from "../src/domain/Report.js";
import { isoSeconds } from "../src/domain/timeUtils.js";
import { IntakeSettings } from "../src/settings/IntakeSettings.js";
import { ReportWorkerSettings } from "../src/settings/ReportWorkerSettings.js";
import { upload } from "./reportFakes.js";

// Thin checks against a real stage; run with RUN_AWS_TESTS=1, AWS credentials and the api and worker variables.
describe.runIf(process.env.RUN_AWS_TESTS === "1")("report adapters against AWS", () => {
  const region = process.env.AWS_REGION ?? "ap-south-1";
  const intake = () => IntakeSettings.fromEnv(process.env);
  const worker = () => ReportWorkerSettings.fromEnv(process.env);
  const ids = new UlidIdGenerator();
  const documents = () =>
    DynamoDBDocumentClient.from(new DynamoDBClient({ region }), { marshallOptions: { removeUndefinedValues: true } });
  const guestReport = () => Report.receive({ ...upload(), upload_id: `upl_${ids.next()}`, device_token: randomUUID() }, isoSeconds(new Date()));

  it("S3 takes the presigned PUT only with the bytes whose checksum was signed", async () => {
    const jpeg = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#777777" } }).jpeg().toBuffer();
    const checksum = createHash("sha256").update(jpeg).digest("base64");
    const signer = new S3UploadSigner(new S3Client({ region }), intake().originalsBucket);
    const key = `reports/upl_${ids.next()}.jpg`;
    const url = await signer.sign({ key, contentType: "image/jpeg", checksumBase64: checksum, expiresInSeconds: 60 });
    const headers = { "Content-Type": "image/jpeg", "x-amz-checksum-sha256": checksum };
    const tampered = await fetch(url, { method: "PUT", headers, body: Buffer.concat([jpeg, Buffer.from([0])]) });
    expect(tampered.status).toBe(400);
    expect((await fetch(url, { method: "PUT", headers, body: jpeg })).status).toBe(200);
  });

  it("DynamoDB creates a report once and reads it back unchanged", async () => {
    const repository = new DynamoReportRepository(documents(), intake().reportsTable);
    const report = guestReport();
    expect(await repository.create(report)).toBe(true);
    expect(await repository.create(report)).toBe(false);
    expect((await repository.get(report.id))?.toRecord()).toEqual(report.toRecord());
  });

  it("DynamoDB refuses a save from a copy read before another writer's save", async () => {
    const repository = new DynamoReportRepository(documents(), intake().reportsTable);
    const report = guestReport();
    await repository.create(report);
    const [first, second] = await Promise.all([repository.get(report.id), repository.get(report.id)]);
    first?.start(isoSeconds(new Date()));
    second?.start(isoSeconds(new Date()));
    await repository.save(first ?? report);
    await expect(repository.save(second ?? report)).rejects.toThrow(ConcurrentUpdateError);
    expect((await repository.get(report.id))?.version).toBe(2);
  });

  it("the by-device index counts a new snap within a few seconds", async () => {
    const report = guestReport();
    await new DynamoReportRepository(documents(), intake().reportsTable).create(report);
    const counter = new DynamoSnapCounter(documents(), intake().reportsTable);
    const since = isoSeconds(new Date(Date.now() - 60_000));
    let count = 0;
    for (let attempt = 0; attempt < 10 && count === 0; attempt += 1) {
      await sleep(500);
      count = await counter.byDevice(report.toRecord().device_token, since);
    }
    expect(count).toBe(1);
  });

  it("reads 0.5 for a device and a user never seen", async () => {
    const tables = { devices: worker().devicesTable, users: worker().usersTable };
    const reader = new DynamoReputationReader(documents(), tables);
    expect(await reader.ofDevice(randomUUID())).toBe(0.5);
    expect(await reader.ofUser(randomUUID())).toBe(0.5);
  });
});
