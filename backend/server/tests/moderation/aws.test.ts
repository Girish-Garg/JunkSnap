import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { S3Client } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it } from "vitest";
import { DynamoHashIndex } from "../../src/adapters/moderation/DynamoHashIndex.js";
import { DynamoReader } from "../../src/adapters/moderation/DynamoReader.js";
import { RekognitionFaceFinder } from "../../src/adapters/moderation/RekognitionFaceFinder.js";
import { RekognitionImageModerator } from "../../src/adapters/moderation/RekognitionImageModerator.js";
import { RekognitionPlateFinder } from "../../src/adapters/moderation/RekognitionPlateFinder.js";
import { S3ImageStore } from "../../src/adapters/moderation/S3ImageStore.js";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import { ExternalServiceError } from "../../src/domain/errors.js";
import { NoteRouterBuilder } from "../../src/handlers/moderation/NoteRouterBuilder.js";
import { LlmNoteModerator } from "../../src/services/moderation/LlmNoteModerator.js";
import { LogSink } from "../LogSink.js";
import { reportSubmission, testJpeg } from "./fakes.js";

// Thin read-only checks against the real services: RUN_AWS_TESTS=1 with AWS_PROFILE set.
const region = "ap-south-1";
const stage = process.env.JUNKSNAP_STAGE ?? "dev";

describe.skipIf(process.env.RUN_AWS_TESTS !== "1")("moderation adapters on AWS", () => {
  const rekognition = new RekognitionClient({ region });

  it("screens, finds faces and reads plates on a plain test image", async () => {
    const jpeg = await testJpeg();
    const screening = await new RekognitionImageModerator(rekognition).screen(jpeg);
    expect(screening.moderationLabels).toEqual([]);
    expect(screening.stamp.version).toMatch(/^\d+\.\d+\+\d+\.\d+$/);
    expect((await new RekognitionFaceFinder(rekognition).find(jpeg)).boxes).toEqual([]);
    expect((await new RekognitionPlateFinder(rekognition).find(jpeg)).boxes).toEqual([]);
  });

  it("queries the stage's sites and reports indexes", async () => {
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
    const reader = new DynamoReader(client);
    const index = new DynamoHashIndex(reader, { reports: `junksnap-${stage}-reports`, sites: `junksnap-${stage}-sites` });
    expect(Array.isArray(await index.earlierPhotos(reportSubmission(new Uint8Array()), 100))).toBe(true);
  });

  // On 10 Oct the Claude models still needed the Anthropic use-case form, so Nova Pro answered.
  it("removes a note with a phone number through Bedrock and keeps a plain one", async () => {
    const logger = new JsonLoggerFactory(new LogSink()).create({ service: "worker", stage });
    const moderator = new LlmNoteModerator(new NoteRouterBuilder(new BedrockRuntimeClient({ region })).build(logger));
    const phone = await moderator.review("Call 98290 12345 about this dump");
    expect(phone).toMatchObject({ result: "removed", reasons: ["personal_data"], provider: "bedrock" });
    expect(await moderator.review("Rotting vegetables dumped here every evening")).toMatchObject({ result: "clean", reasons: [] });
  });

  it("reports a missing original as ExternalServiceError", async () => {
    const store = new S3ImageStore(new S3Client({ region }), { originals: `junksnap-${stage}-no-such-bucket`, public: "unused" });
    await expect(store.readOriginal("reports/upl_missing.jpg", 10)).rejects.toThrow(ExternalServiceError);
  });
});
