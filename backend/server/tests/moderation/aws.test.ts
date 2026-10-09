import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { S3Client } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it } from "vitest";
import { DynamoHashIndex } from "../../src/adapters/moderation/DynamoHashIndex.js";
import { RekognitionFaceFinder } from "../../src/adapters/moderation/RekognitionFaceFinder.js";
import { RekognitionImageModerator } from "../../src/adapters/moderation/RekognitionImageModerator.js";
import { RekognitionPlateFinder } from "../../src/adapters/moderation/RekognitionPlateFinder.js";
import { S3ImageStore } from "../../src/adapters/moderation/S3ImageStore.js";
import { ExternalServiceError } from "../../src/domain/errors.js";
import { JODHPUR, testJpeg } from "./fakes.js";

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
    const index = new DynamoHashIndex(client, { reports: `junksnap-${stage}-reports`, sites: `junksnap-${stage}-sites` });
    expect(Array.isArray(await index.near(JODHPUR, 100))).toBe(true);
  });

  it("reports a missing original as ExternalServiceError", async () => {
    const store = new S3ImageStore(new S3Client({ region }), { originals: `junksnap-${stage}-no-such-bucket`, public: "unused" });
    await expect(store.readOriginal("reports/upl_missing.jpg", 10)).rejects.toThrow(ExternalServiceError);
  });
});
