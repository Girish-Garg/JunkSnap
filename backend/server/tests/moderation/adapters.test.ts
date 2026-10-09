import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { S3Client } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it, vi } from "vitest";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import { DynamoCleanupHashIndex } from "../../src/adapters/moderation/DynamoCleanupHashIndex.js";
import { DynamoHashIndex } from "../../src/adapters/moderation/DynamoHashIndex.js";
import { DynamoReader } from "../../src/adapters/moderation/DynamoReader.js";
import { RekognitionFaceFinder } from "../../src/adapters/moderation/RekognitionFaceFinder.js";
import { RekognitionImageModerator } from "../../src/adapters/moderation/RekognitionImageModerator.js";
import { RekognitionPlateFinder } from "../../src/adapters/moderation/RekognitionPlateFinder.js";
import { S3ImageStore } from "../../src/adapters/moderation/S3ImageStore.js";
import { ConfigError, ExternalServiceError, InternalDataError } from "../../src/domain/errors.js";
import { GeoPoint } from "../../src/domain/moderation/GeoPoint.js";
import { PhotoSubmission } from "../../src/domain/moderation/PhotoSubmission.js";
import { ModerationServiceFactory } from "../../src/handlers/moderation/ModerationServiceFactory.js";
import { ModerationService } from "../../src/services/moderation/ModerationService.js";
import { CoreSettings } from "../../src/settings/CoreSettings.js";
import { ModerationSettings } from "../../src/settings/ModerationSettings.js";
import { LogSink } from "../LogSink.js";
import { FakeDeviceRegistry, JODHPUR, RECEIVED_AT, reportSubmission } from "./fakes.js";

interface SentCommand {
  readonly constructor: { readonly name: string };
  readonly input: Record<string, unknown>;
}

// Replaces client.send so each command name gets a canned response; records what was sent.
function stub<C extends { send: unknown }>(client: C, respond: (command: SentCommand) => unknown): SentCommand[] {
  const sent: SentCommand[] = [];
  vi.spyOn(client as { send: (command: SentCommand) => Promise<unknown> }, "send").mockImplementation(async (command) => {
    sent.push(command);
    const response = respond(command);
    if (response instanceof Error) {
      throw response;
    }
    return response;
  });
  return sent;
}

const bbox = (Left: number, Top: number, Width: number, Height: number) => ({ Left, Top, Width, Height });
const rekognition = () => new RekognitionClient({ region: "ap-south-1" });

describe("RekognitionImageModerator", () => {
  it("walks ParentName to the top category and keeps Person instance boxes", async () => {
    const client = rekognition();
    const sent = stub(client, (command) =>
      command.constructor.name === "DetectModerationLabelsCommand"
        ? {
            ModerationModelVersion: "7.0",
            ModerationLabels: [
              { Name: "Violence", ParentName: "" },
              { Name: "Weapon Violence", ParentName: "Violence" },
              { Name: "Blood & Gore", ParentName: "Graphic Violence" },
            ],
          }
        : {
            LabelModelVersion: "3.0",
            Labels: [
              { Name: "Person", Instances: [{ BoundingBox: bbox(0.1, 0.1, 0.2, 0.5) }, { BoundingBox: {} }] },
            ],
          },
    );
    const screening = await new RekognitionImageModerator(client).screen(new Uint8Array([1]));
    expect(screening.moderationLabels).toEqual([
      { name: "Violence", category: "Violence" },
      { name: "Weapon Violence", category: "Violence" },
      { name: "Blood & Gore", category: "Graphic Violence" },
    ]);
    expect(screening.people).toHaveLength(1);
    expect(screening.stamp).toEqual({ provider: "rekognition", model: "DetectModerationLabels+DetectLabels", version: "7.0+3.0" });
    const labels = sent.find((command) => command.constructor.name === "DetectLabelsCommand");
    expect(labels?.input).toMatchObject({ MinConfidence: 70, Settings: { GeneralLabels: { LabelInclusionFilters: ["Person"] } } });
  });

  it("turns an SDK failure into ExternalServiceError", async () => {
    const client = rekognition();
    stub(client, () => new Error("ThrottlingException"));
    await expect(new RekognitionImageModerator(client).screen(new Uint8Array([1]))).rejects.toThrow(ExternalServiceError);
  });
});

describe("RekognitionFaceFinder", () => {
  it("returns every face box, without a model version", async () => {
    const client = rekognition();
    stub(client, () => ({ FaceDetails: [{ BoundingBox: bbox(0.6, 0.29, 0.1, 0.1), Confidence: 51 }] }));
    const found = await new RekognitionFaceFinder(client).find(new Uint8Array([1]));
    expect(found).toMatchObject({ model: "DetectFaces", version: null });
    expect(found.boxes[0]).toMatchObject({ left: 0.6, top: 0.29 });
  });
});

describe("RekognitionPlateFinder", () => {
  it("joins text plates with label plates that no text plate covers", async () => {
    const client = rekognition();
    stub(client, (command) =>
      command.constructor.name === "DetectTextCommand"
        ? {
            TextModelVersion: "3.0",
            TextDetections: [
              { Id: 0, Type: "LINE", DetectedText: "MERCHANT SHOP", Geometry: { BoundingBox: bbox(0.1, 0.1, 0.3, 0.05) } },
              { Id: 1, Type: "LINE", DetectedText: "AP13 W 9238", Geometry: { BoundingBox: bbox(0.4, 0.6, 0.1, 0.03) } },
              { Id: 2, Type: "WORD", ParentId: 1, DetectedText: "AP13", Geometry: { BoundingBox: bbox(0.4, 0.6, 0.04, 0.03) } },
            ],
          }
        : {
            LabelModelVersion: "3.0",
            Labels: [
              {
                Name: "License Plate",
                Instances: [{ BoundingBox: bbox(0.41, 0.6, 0.08, 0.03) }, { BoundingBox: bbox(0.8, 0.8, 0.1, 0.04) }],
              },
            ],
          },
    );
    const found = await new RekognitionPlateFinder(client).find(new Uint8Array([1]));
    expect(found.boxes.map((plate) => plate.left)).toEqual([0.4, 0.8]);
    expect(found).toMatchObject({ model: "DetectText+DetectLabels", version: "3.0+3.0" });
  });
});

describe("S3ImageStore", () => {
  const buckets = { originals: "originals-bucket", public: "public-bucket" };

  it("reads at most one byte over the limit and refuses a larger object", async () => {
    const client = new S3Client({ region: "ap-south-1" });
    const sent = stub(client, () => ({ Body: { transformToByteArray: async () => new Uint8Array(11) } }));
    const store = new S3ImageStore(client, buckets);
    expect(await store.readOriginal("reports/upl_x.jpg", 10)).toBeNull();
    expect(await store.readOriginal("reports/upl_x.jpg", 11)).toHaveLength(11);
    expect(sent[0]?.input).toEqual({ Bucket: "originals-bucket", Key: "reports/upl_x.jpg", Range: "bytes=0-10" });
  });

  it("reads an empty object, which S3 answers with InvalidRange, as no bytes", async () => {
    const client = new S3Client({ region: "ap-south-1" });
    stub(client, () => Object.assign(new Error("The requested range is not satisfiable"), { name: "InvalidRange" }));
    expect(await new S3ImageStore(client, buckets).readOriginal("reports/upl_x.jpg", 10)).toEqual(new Uint8Array());
  });

  it("writes the blurred copy as a JPEG to the public bucket", async () => {
    const client = new S3Client({ region: "ap-south-1" });
    const sent = stub(client, () => ({}));
    await new S3ImageStore(client, buckets).writePublic("media/reports/rpt_x.jpg", new Uint8Array([1]));
    expect(sent[0]?.input).toMatchObject({ Bucket: "public-bucket", Key: "media/reports/rpt_x.jpg", ContentType: "image/jpeg" });
  });
});

describe("DynamoHashIndex", () => {
  it("finds sites near the point through by-geohash, then their reports through by-site, across pages", async () => {
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "ap-south-1" }));
    const sent = stub(client, (command) => {
      const input = command.input;
      if (input.IndexName === "by-geohash") {
        return { Items: [{ site_id: "site_near", lat: JODHPUR.lat + 0.0003, lon: JODHPUR.lon }, { site_id: "site_far", lat: 26.5, lon: 73.2 }] };
      }
      return input.ExclusiveStartKey === undefined
        ? { Items: [{ report_id: "rpt_a", gps: { lat: JODHPUR.lat, lon: JODHPUR.lon }, moderation_result: { phash: "c4e1b3a59d0f2687" } }], LastEvaluatedKey: { report_id: "rpt_a" } }
        : { Items: [{ report_id: "rpt_b", gps: { lat: JODHPUR.lat, lon: JODHPUR.lon } }] };
    });
    const index = new DynamoHashIndex(new DynamoReader(client), { reports: "reports-table", sites: "sites-table" });
    const photos = await index.earlierPhotos(reportSubmission(new Uint8Array()), 100);
    expect(photos.map((photo) => [photo.photoId, photo.hash.toHex()])).toEqual([["rpt_a", "c4e1b3a59d0f2687"]]);
    const siteQueries = sent.filter((command) => command.input.IndexName === "by-site");
    expect(siteQueries.map((command) => command.input.ExpressionAttributeValues)).toEqual([{ ":site": "site_near" }, { ":site": "site_near" }]);
  });
});

describe("DynamoHashIndex on bad rows", () => {
  it("refuses a moderated report row without a readable pHash", async () => {
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "ap-south-1" }));
    stub(client, (command) =>
      command.input.IndexName === "by-geohash"
        ? { Items: [{ site_id: "site_near", lat: JODHPUR.lat, lon: JODHPUR.lon }] }
        : { Items: [{ report_id: "rpt_a", gps: { lat: JODHPUR.lat, lon: JODHPUR.lon }, moderation_result: { phash: "zz" } }] },
    );
    const index = new DynamoHashIndex(new DynamoReader(client), { reports: "reports-table", sites: "sites-table" });
    await expect(index.earlierPhotos(reportSubmission(new Uint8Array()), 100)).rejects.toThrow(InternalDataError);
  });
});

describe("DynamoCleanupHashIndex", () => {
  it("scans the cleanups table for this site's earlier after-photos, across pages", async () => {
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "ap-south-1" }));
    const gps = { lat: 26.2702, lon: 73.0458 };
    const sent = stub(client, (command) =>
      command.input.ExclusiveStartKey === undefined
        ? { Items: [{ cleanup_id: "cln_a", gps, moderation_result: { phash: "c4e1b3a59d0f2687" } }], LastEvaluatedKey: { cleanup_id: "cln_a" } }
        : { Items: [{ cleanup_id: "cln_b", gps }] },
    );
    const submission = PhotoSubmission.fromCleanup(
      { site_id: "site_jdh_3", upload_id: "upl_c", device_token: "d", sha256: "0".repeat(64), gps, captured_at: RECEIVED_AT, received_at: RECEIVED_AT },
      new GeoPoint(26.2701, 73.0458),
    );
    const photos = await new DynamoCleanupHashIndex(new DynamoReader(client), "cleanups-table").earlierPhotos(submission);
    expect(photos.map((photo) => photo.photoId)).toEqual(["cln_a"]);
    expect(sent[0]?.input).toMatchObject({ TableName: "cleanups-table", FilterExpression: "site_id = :site", ExpressionAttributeValues: { ":site": "site_jdh_3" } });
    await expect(new DynamoCleanupHashIndex(new DynamoReader(client), "t").earlierPhotos(reportSubmission(new Uint8Array()))).rejects.toThrow(InternalDataError);
  });
});

describe("ModerationSettings and ModerationServiceFactory", () => {
  const env = {
    ORIGINALS_BUCKET: "junksnap-dev-originals-1",
    PUBLIC_BUCKET: "junksnap-dev-public-1",
    REPORTS_TABLE: "junksnap-dev-reports",
    CLEANUPS_TABLE: "junksnap-dev-cleanups",
    SITES_TABLE: "junksnap-dev-sites",
  };

  it("needs the buckets and tables and finds data/ from backend/server by default", () => {
    expect(() => ModerationSettings.fromEnv({})).toThrow(ConfigError);
    const settings = ModerationSettings.fromEnv(env, "/repo/backend/server");
    expect(settings.indiaOutlinePath().replaceAll("\\", "/")).toMatch(/\/repo\/data\/boundaries\/india_outline\.geojson$/);
    expect(ModerationSettings.fromEnv({ ...env, ASSETS_DIR: "/assets" }, "/x").assetsDir.replaceAll("\\", "/")).toMatch(/\/assets$/);
  });

  it("builds the worker's service graph, Bedrock note router included, without calling AWS", () => {
    const core = CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" });
    const logger = new JsonLoggerFactory(new LogSink()).create({ service: "worker", stage: "dev" });
    const service = ModerationServiceFactory.forWorker({ settings: core, logger, env }, new FakeDeviceRegistry());
    expect(service).toBeInstanceOf(ModerationService);
    expect(() => ModerationServiceFactory.forWorker({ settings: core, logger, env: {} }, new FakeDeviceRegistry())).toThrow(ConfigError);
  });
});
