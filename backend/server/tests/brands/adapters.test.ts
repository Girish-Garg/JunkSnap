import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DetectLabelsCommand, DetectTextCommand, DetectTextCommandOutput } from "@aws-sdk/client-rekognition";
import type { GetObjectCommand } from "@aws-sdk/client-s3";
import { afterAll, describe, expect, it } from "vitest";
import { BytesImageSource } from "./BytesImageSource.js";
import { FileBrandMap } from "../../src/adapters/brands/FileBrandMap.js";
import { PublicBucketImageSource } from "../../src/adapters/brands/PublicBucketImageSource.js";
import { RekognitionTextPresence } from "../../src/adapters/brands/RekognitionTextPresence.js";
import { RekognitionTextReader } from "../../src/adapters/brands/RekognitionTextReader.js";
import { S3BlurredImageStore, type GetObjectClient } from "../../src/adapters/brands/S3BlurredImageStore.js";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import { BlurredImage } from "../../src/domain/brands/BlurredImage.js";
import { ConfigError, ExternalServiceError, NotFoundError, ValidationError } from "../../src/domain/errors.js";
import { buildBrandLabeller } from "../../src/handlers/buildBrandLabeller.js";
import { BrandLabeller } from "../../src/services/brands/BrandLabeller.js";
import { BrandSettings } from "../../src/settings/BrandSettings.js";
import { CoreSettings } from "../../src/settings/CoreSettings.js";
import { LogSink } from "../LogSink.js";

const FIXTURE = fileURLToPath(new URL("../fixtures/brands/brands.json", import.meta.url));
const IMAGE = new BlurredImage("rpt_jdh_1");
const BUCKET = "junksnap-dev-public-123456789012";

const DETECTED: DetectTextCommandOutput = {
  $metadata: {},
  TextModelVersion: "3.0",
  TextDetections: [
    { Type: "LINE", Id: 0, DetectedText: "Coca Cola", Confidence: 98 },
    { Type: "LINE", Id: 1, DetectedText: "PEPSI", Confidence: 91 },
    { Type: "WORD", Id: 2, ParentId: 0, DetectedText: "Coca", Confidence: 98, Geometry: { BoundingBox: { Left: -0.01, Top: 0.2, Width: 0.1, Height: 0.05 } } },
    { Type: "WORD", Id: 3, ParentId: 0, DetectedText: "Cola", Confidence: 97.5, Geometry: { BoundingBox: { Left: 0.1, Top: 0.2, Width: 0.1, Height: 0.05 } } },
    { Type: "WORD", Id: 4, ParentId: 1, DetectedText: "PEPSI", Confidence: 91, Geometry: { BoundingBox: { Left: 0.95, Top: 0.9, Width: 0.2, Height: 0.2 } } },
  ],
};

class FakeRekognition {
  readonly commands: (DetectTextCommand | DetectLabelsCommand)[] = [];
  readonly #reply: () => Promise<unknown>;

  constructor(reply: () => Promise<unknown>) {
    this.#reply = reply;
  }

  async send<T>(command: DetectTextCommand | DetectLabelsCommand): Promise<T> {
    this.commands.push(command);
    return (await this.#reply()) as T;
  }
}

describe("RekognitionTextReader", () => {
  it("reads the blurred copy from the public bucket and groups words under their lines", async () => {
    const client = new FakeRekognition(async () => DETECTED);
    const reading = await new RekognitionTextReader(client, new PublicBucketImageSource(BUCKET)).read(IMAGE);
    expect(client.commands[0]?.input.Image).toEqual({ S3Object: { Bucket: BUCKET, Name: "media/reports/rpt_jdh_1.jpg" } });
    expect(reading.source).toEqual({ provider: "rekognition", model: "DetectText", version: "3.0" });
    expect(reading.lines.map((line) => [line.text, line.confidence, line.words.map((word) => word.text)])).toEqual([
      ["Coca Cola", 0.98, ["Coca", "Cola"]],
      ["PEPSI", 0.91, ["PEPSI"]],
    ]);
    expect(reading.lines[0]?.words[0]?.box.toContract()).toEqual({ left: 0, top: 0.2, width: 0.1, height: 0.05 });
    expect(reading.lines[1]?.words[0]?.box.toContract()).toEqual({ left: 0.95, top: 0.9, width: 0.05, height: 0.1 });
  });

  it("turns SDK failures and a missing model version into ExternalServiceError", async () => {
    const failing = new FakeRekognition(async () => Promise.reject(new Error("throttled")));
    const unversioned = new FakeRekognition(async () => ({ ...DETECTED, TextModelVersion: undefined }));
    for (const client of [failing, unversioned]) {
      const reader = new RekognitionTextReader(client, new PublicBucketImageSource(BUCKET));
      await expect(reader.read(IMAGE)).rejects.toThrow(ExternalServiceError);
    }
  });
});

describe("RekognitionTextPresence", () => {
  it("asks DetectLabels for the Text label only", async () => {
    const client = new FakeRekognition(async () => ({ Labels: [{ Name: "Text", Confidence: 94 }] }));
    const images = new BytesImageSource(new Map([["rpt_jdh_1", new Uint8Array([255, 216])]]));
    expect(await new RekognitionTextPresence(client, images).hasText(IMAGE)).toBe(true);
    expect(client.commands[0]?.input).toMatchObject({
      Image: { Bytes: new Uint8Array([255, 216]) },
      Settings: { GeneralLabels: { LabelInclusionFilters: ["Text"] } },
    });
    const empty = new FakeRekognition(async () => ({ Labels: [] }));
    expect(await new RekognitionTextPresence(empty, images).hasText(IMAGE)).toBe(false);
  });

  it("fails clearly when no bytes were given for a report", async () => {
    const presence = new RekognitionTextPresence(new FakeRekognition(async () => ({})), new BytesImageSource(new Map()));
    await expect(presence.hasText(IMAGE)).rejects.toThrow(NotFoundError);
  });
});

describe("FileBrandMap", () => {
  const folders: string[] = [];
  afterAll(async () => Promise.all(folders.map((folder) => rm(folder, { recursive: true }))));

  async function mapWith(text: string): Promise<FileBrandMap> {
    const folder = await mkdtemp(join(tmpdir(), "server-21-brands-"));
    folders.push(folder);
    await writeFile(join(folder, "brands.json"), text);
    return new FileBrandMap(join(folder, "brands.json"));
  }

  it("loads the rows once, aliases and sources included", async () => {
    const map = new FileBrandMap(FIXTURE);
    const entries = await map.entries();
    expect(entries.map((entry) => [entry.brand, entry.aliases.length, entry.hasDevanagari()])).toEqual([
      ["Pepsi", 1, false],
      ["Kurkure", 1, false],
      ["Bikaji", 2, true],
    ]);
    expect(entries[2]?.sourceUrl).toBe("https://example.org/brands/bikaji");
    expect(await map.entries()).toBe(entries);
  });

  it("loads the shipped data/brands/brands.json with unique brand names", async () => {
    const shipped = fileURLToPath(new URL("../../../../data/brands/brands.json", import.meta.url));
    const brands = (await new FileBrandMap(shipped).entries()).map((entry) => entry.brand);
    expect(brands.length).toBeGreaterThan(0);
    expect(new Set(brands).size).toBe(brands.length);
  });

  it.each([
    ["a missing file", null],
    ["broken JSON", "{"],
    ["a row without a source URL", '{"brands":[{"brand":"X","aliases":[{"text":"X","require_exact":true}],"parent_company":"Y"}]}'],
  ])("rejects %s with ConfigError", async (_name, text) => {
    const map = text === null ? new FileBrandMap(join(tmpdir(), "server-21-brands-missing.json")) : await mapWith(text);
    await expect(map.entries()).rejects.toThrow(ConfigError);
  });
});

describe("BlurredImage, BrandSettings and buildBrandLabeller", () => {
  it("only names the public blurred copy of a report", () => {
    expect(IMAGE.key).toBe("media/reports/rpt_jdh_1.jpg");
    for (const id of ["upl_jdh_1", "rpt_../originals", "reports/upl_x"]) {
      expect(() => new BlurredImage(id)).toThrow(ValidationError);
    }
  });

  it("reads PUBLIC_BUCKET and ASSETS_DIR", () => {
    const settings = BrandSettings.fromEnv({ PUBLIC_BUCKET: BUCKET, ASSETS_DIR: "/app/assets" });
    expect(settings.publicBucket).toBe(BUCKET);
    expect(settings.brandMapPath).toBe(join("/app/assets", "brands", "brands.json"));
    expect(() => BrandSettings.fromEnv({ PUBLIC_BUCKET: BUCKET })).toThrow(/ASSETS_DIR/);
  });

  it("builds the worker's brands step with the LLM judge, without network calls", () => {
    const sink = new LogSink();
    const logger = new JsonLoggerFactory(sink).create({ service: "worker", stage: "dev" });
    const env = { JUNKSNAP_STAGE: "dev", PUBLIC_BUCKET: BUCKET, ASSETS_DIR: "/app/assets" };
    expect(buildBrandLabeller({ core: CoreSettings.fromEnv(env), env, logger })).toBeInstanceOf(BrandLabeller);
    expect(sink.records()).toEqual([]);
  });
});

describe("S3BlurredImageStore", () => {
  const body = (bytes: Uint8Array) => ({ transformToByteArray: async () => bytes });

  it("reads the blurred copy from the public bucket", async () => {
    const commands: GetObjectCommand[] = [];
    const client = {
      send: async (command: GetObjectCommand) => {
        commands.push(command);
        return { Body: body(new Uint8Array([255, 216])) };
      },
    };
    const bytes = await new S3BlurredImageStore(client as unknown as GetObjectClient, BUCKET).jpegBytes(IMAGE);
    expect(bytes).toEqual(new Uint8Array([255, 216]));
    expect(commands[0]?.input).toEqual({ Bucket: BUCKET, Key: "media/reports/rpt_jdh_1.jpg" });
  });

  it.each([
    ["an SDK failure", async () => Promise.reject(new Error("AccessDenied"))],
    ["a missing body", async () => ({})],
  ])("turns %s into ExternalServiceError", async (_name, send) => {
    const store = new S3BlurredImageStore({ send } as unknown as GetObjectClient, BUCKET);
    await expect(store.jpegBytes(IMAGE)).rejects.toThrow(ExternalServiceError);
  });
});
