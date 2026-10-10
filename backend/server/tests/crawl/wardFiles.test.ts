import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import { DirectoryWardFiles } from "../../src/adapters/wards/DirectoryWardFiles.js";
import { NewestWardFiles } from "../../src/adapters/wards/NewestWardFiles.js";
import { S3CrawledWardFiles } from "../../src/adapters/wards/S3CrawledWardFiles.js";
import { WardRecordAreaFacts } from "../../src/adapters/WardRecordAreaFacts.js";
import { WardFilesFactory } from "../../src/handlers/WardFilesFactory.js";
import type { WardFile, WardFileSource } from "../../src/ports/WardFileSource.js";
import { CrawledWardSettings } from "../../src/settings/CrawledWardSettings.js";
import { LogSink } from "../LogSink.js";
import { failure, ScriptedClient, type SentCommand } from "../sites/ScriptedClient.js";

const BUCKET = "junksnap-dev-originals-123456789012";

function folder(files: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), "junksnap-wards-"));
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, name), typeof body === "string" ? body : JSON.stringify(body));
  }
  return dir;
}

const logger = (sink: LogSink) => new JsonLoggerFactory(sink).create({ service: "scores", stage: "dev" });
const cityFile = (generatedAt: unknown, note = "") => ({ city: "x", generated_at: generatedAt, note, records: [] });

class FixedFiles implements WardFileSource {
  constructor(readonly list: readonly WardFile[]) {}

  async files(): Promise<readonly WardFile[]> {
    return Promise.resolve(this.list);
  }
}

describe("DirectoryWardFiles", () => {
  it("lists the .json files by name with their city", async () => {
    const dir = folder({ "jodhpur.json": {}, "jaipur.json": {}, "README.md": "notes" });
    expect(await new DirectoryWardFiles(dir).files()).toEqual([
      { city: "jaipur", path: join(dir, "jaipur.json") },
      { city: "jodhpur", path: join(dir, "jodhpur.json") },
    ]);
  });

  it("has no files without the folder", async () => {
    expect(await new DirectoryWardFiles(join(tmpdir(), "junksnap-no-such-folder")).files()).toEqual([]);
  });
});

describe("S3CrawledWardFiles", () => {
  const bytes = (text: string) => ({ Body: { transformToByteArray: async () => Promise.resolve(new TextEncoder().encode(text)) } });

  function answer(command: SentCommand): unknown {
    if (command.name === "ListObjectsV2Command") {
      return command.input["ContinuationToken"] === undefined
        ? { IsTruncated: true, NextContinuationToken: "page-2", Contents: [{ Key: "crawl/wards/jodhpur.json" }, { Key: "crawl/wards/old/x.json" }] }
        : { IsTruncated: false, Contents: [{ Key: "crawl/wards/jaipur.json" }, { Key: "crawl/wards/../../etc.json" }] };
    }
    return bytes(`{"city":"${String(command.input["Key"])}","records":[]}`);
  }

  it("lists every page of crawl/wards/ and downloads each city file", async () => {
    const client = new ScriptedClient([], answer);
    const dir = mkdtempSync(join(tmpdir(), "junksnap-crawled-"));
    const files = await new S3CrawledWardFiles(client.as<S3Client>(), BUCKET, join(dir, "wards"), logger(new LogSink())).files();
    expect(files).toEqual([
      { city: "jaipur", path: join(dir, "wards", "jaipur.json") },
      { city: "jodhpur", path: join(dir, "wards", "jodhpur.json") },
    ]);
    expect(readFileSync(join(dir, "wards", "jodhpur.json"), "utf8")).toBe('{"city":"crawl/wards/jodhpur.json","records":[]}');
    expect(client.sent[0]?.input).toMatchObject({ Bucket: BUCKET, Prefix: "crawl/wards/" });
    expect(client.sent.filter((command) => command.name === "GetObjectCommand").map((command) => command.input["Key"]).sort()).toEqual([
      "crawl/wards/jaipur.json",
      "crawl/wards/jodhpur.json",
    ]);
  });

  it.each(["{", '{"records":"none"}'])("skips a crawled file that is not a city file: %s", async (body) => {
    const sink = new LogSink();
    const list = () => ({ Contents: [{ Key: "crawl/wards/jodhpur.json" }] });
    const client = new ScriptedClient([list, () => bytes(body)]);
    const files = await new S3CrawledWardFiles(client.as<S3Client>(), BUCKET, mkdtempSync(join(tmpdir(), "junksnap-bad-")), logger(sink)).files();
    expect(files).toEqual([]);
    expect(sink.records()).toEqual([expect.objectContaining({ level: "WARN", key: "crawl/wards/jodhpur.json" })]);
  });

  it("logs an S3 failure and falls back to no crawled files", async () => {
    const sink = new LogSink();
    const client = new ScriptedClient([failure("AccessDenied")]);
    const files = await new S3CrawledWardFiles(client.as<S3Client>(), BUCKET, tmpdir(), logger(sink)).files();
    expect(files).toEqual([]);
    expect(sink.records()).toEqual([expect.objectContaining({ level: "WARN", prefix: "crawl/wards/" })]);
  });
});

describe("NewestWardFiles", () => {
  const image = folder({
    "jodhpur.json": cityFile("2026-10-09T22:42:09Z", "image"),
    "jaipur.json": cityFile("2026-10-09T22:35:21Z", "image"),
    "ajmer.json": cityFile("2026-10-09T10:00:00Z", "image"),
  });
  const crawled = folder({
    "jodhpur.json": cityFile("2026-10-10T09:40:02Z", "crawl"),
    "jaipur.json": cityFile("2026-10-09T22:35:21Z", "crawl"),
    "ajmer.json": cityFile("not a date", "crawl"),
    "bikaner.json": "{",
  });
  const note = (file: WardFile) => (JSON.parse(readFileSync(file.path, "utf8")) as { note?: string }).note ?? "unreadable";

  it("keeps the newer file per city; a tie or an unreadable date keeps the image's file", async () => {
    const files = await new NewestWardFiles([new DirectoryWardFiles(image), new DirectoryWardFiles(crawled)]).files();
    const picked = files.map((file) => [file.city, file.city === "bikaner" ? "unreadable" : note(file)]);
    expect(picked).toEqual([
      ["ajmer", "image"],
      ["bikaner", "unreadable"],
      ["jaipur", "image"],
      ["jodhpur", "crawl"],
    ]);
  });

  it("keeps a file with reviewed records over a newer unreviewed crawl", async () => {
    const reviewed = JSON.stringify({ generated_at: "2026-10-09T22:42:09Z", note: "image", records: [{ review_status: "reviewed" }] });
    const older = folder({ "jodhpur.json": reviewed });
    const files = await new NewestWardFiles([new DirectoryWardFiles(older), new DirectoryWardFiles(crawled)]).files();
    expect(files.filter((file) => file.city === "jodhpur").map(note)).toEqual(["image"]);
  });

  it("keeps a file with map layers over a newer crawl without any", async () => {
    const withLayers = JSON.stringify({ ...cityFile("2026-10-09T22:42:09Z", "image"), map_layers: [{ kind: "school" }] });
    const files = await new NewestWardFiles([new DirectoryWardFiles(folder({ "jodhpur.json": withLayers })), new DirectoryWardFiles(crawled)]).files();
    expect(files.filter((file) => file.city === "jodhpur").map(note)).toEqual(["image"]);
  });

  it("feeds the newest files to the scores job's ward facts", async () => {
    const assets = folder({});
    mkdirSync(join(assets, "representatives"));
    writeFileSync(join(assets, "representatives", "local_bodies.json"), "[]");
    const source = new NewestWardFiles([new FixedFiles([{ city: "jodhpur", path: join(image, "jodhpur.json") }])]);
    const facts = await WardRecordAreaFacts.fromFiles(source, assets);
    expect(facts.skippedRecords()).toEqual([]);
  });
});

describe("WardFilesFactory", () => {
  it("reads only the image's folder without an originals bucket", () => {
    const places = { assetsDir: "/app/data", originalsBucket: null, awsRegion: "ap-south-1" };
    expect(new WardFilesFactory().create(places, logger(new LogSink()))).toBeInstanceOf(DirectoryWardFiles);
  });

  it("adds the crawled files with an originals bucket", () => {
    const places = { assetsDir: "/app/data", originalsBucket: BUCKET, awsRegion: "ap-south-1" };
    expect(new WardFilesFactory().create(places, logger(new LogSink()))).toBeInstanceOf(NewestWardFiles);
  });

  it("treats an empty ORIGINALS_BUCKET as absent", () => {
    expect(CrawledWardSettings.fromEnv({ ORIGINALS_BUCKET: "" }).originalsBucket).toBeNull();
    expect(CrawledWardSettings.fromEnv({ ORIGINALS_BUCKET: BUCKET }).originalsBucket).toBe(BUCKET);
  });
});
