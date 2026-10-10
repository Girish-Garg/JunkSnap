import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WardRecordAreaFacts } from "../../src/adapters/WardRecordAreaFacts.js";
import type { WardRecord } from "../../src/contracts/index.gen.js";
import { AreaKey } from "../../src/domain/AreaKey.js";
import { InternalDataError } from "../../src/domain/errors.js";
import { ScoresSettings } from "../../src/settings/ScoresSettings.js";
import { readContract } from "./siteBuilder.js";

interface Provenance {
  readonly source_url: string;
  readonly fetched_at: string;
  readonly page_sha256: string;
}

const FIXTURE = readContract<WardRecord>("fixtures/ward_record.jdh-1.json");
// The generated SourcedWardNumber type leaves out the provenance fields its schema $refs.
const { source_url, fetched_at, page_sha256 } = readContract<{ ward_number: Provenance }>("fixtures/ward_record.jdh-1.json").ward_number;
const PROVENANCE: Provenance = { source_url, fetched_at, page_sha256 };
const LAYER = { ...PROVENANCE, count: 1, features: [{ ref: "osm:node/1", coords: [[26.26, 73.0]] }] };
const NOTHING = { areaKm2: null, placesMapped: false };

function reviewedWard(number: number, extra: Partial<WardRecord> = {}): WardRecord {
  const id = `jodhpur-mc-w${number}`;
  return { ...FIXTURE, id, ward_number: { ...FIXTURE.ward_number, value: number }, review_status: "reviewed", ...extra };
}

const wardArea = (number: number) => AreaKey.parse("ward", `jodhpur-mc-w${number}`);

function load(dir: string | null): Promise<WardRecordAreaFacts> {
  return WardRecordAreaFacts.fromDirectory(dir);
}

let assets: string;

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(join(assets, path), JSON.stringify(value));
}

beforeAll(async () => {
  assets = await mkdtemp(join(tmpdir(), "server-20-scores-assets-"));
  await mkdir(join(assets, "wards"));
  await mkdir(join(assets, "representatives"));
  const measured = reviewedWard(37, {
    area_km2: { ...PROVENANCE, value: 2.5 },
    disposal_points: [{ ...PROVENANCE, lat: 26.2589, lon: 73.0071, kind: "collection_point", ref: "osm:node/4" }],
  });
  const uttar = reviewedWard(40, { id: "jodhpur-uttar-mc-w40", area_km2: { ...PROVENANCE, value: 1.5 } });
  const records = [FIXTURE, measured, reviewedWard(12), reviewedWard(12), uttar];
  await writeJson("wards/jodhpur.json", { records, map_layers: [{ ...LAYER, kind: "school" }, { ...LAYER, kind: "water" }, { ...LAYER, kind: "disposal" }] });
  await writeJson("wards/jaipur.json", { records: [], map_layers: [{ ...LAYER, kind: "disposal" }] });
  await writeJson("wards/notes.txt", "not a city file");
  await writeJson("representatives/local_bodies.json", [
    { id: "jodhpur-mc", towns: ["Jodhpur"] },
    { id: "jaipur-mc", towns: ["Jaipur"] },
  ]);
});

afterAll(async () => {
  await rm(assets, { recursive: true, force: true });
});

describe("WardRecordAreaFacts", () => {
  it("loads the committed ward files in data/", async () => {
    const repoData = fileURLToPath(new URL("../../../../data", import.meta.url));
    await expect(load(repoData)).resolves.toBeInstanceOf(WardRecordAreaFacts);
  });

  it("never uses the unreviewed contract fixture record", async () => {
    expect(FIXTURE.review_status).not.toBe("reviewed");
    const facts = await (await load(assets)).factsFor(wardArea(FIXTURE.ward_number.value), []);
    expect(facts).toEqual(NOTHING);
  });

  it("joins a ward area on its local body's city and ward number for km² and disposal points", async () => {
    const facts = await (await load(assets)).factsFor(wardArea(37), ["jodhpur-mc"]);
    expect(facts).toEqual({ areaKm2: 2.5, placesMapped: true });
    expect((await load(assets)).skippedRecords()).toEqual([]);
  });

  it("never attaches a pre-merger Uttar record to a jodhpur-mc ward with the same number", async () => {
    const facts = await (await load(assets)).factsFor(wardArea(40), ["jodhpur-mc"]);
    expect(facts).toEqual({ ...NOTHING, placesMapped: true });
  });

  it("treats a ward id that two reviewed records share as unknown", async () => {
    const facts = await (await load(assets)).factsFor(wardArea(12), ["jodhpur-mc"]);
    expect(facts).toEqual({ ...NOTHING, placesMapped: true });
  });

  it("gives seats no km² or disposal points, only whether their cities have school or water layers", async () => {
    const source = await load(assets);
    const seat = AreaKey.parse("assembly", "s20-ac-128");
    expect(await source.factsFor(seat, ["jodhpur-mc"])).toEqual({ ...NOTHING, placesMapped: true });
    expect(await source.factsFor(seat, ["jaipur-mc"])).toEqual(NOTHING);
    expect(await source.factsFor(seat, ["unknown-mc"])).toEqual(NOTHING);
  });

  it.each([null, "missing-folder"])("knows nothing when ASSETS_DIR is %s", async (dir) => {
    const source = await load(dir === null ? null : join(assets, dir));
    expect(await source.factsFor(wardArea(37), ["jodhpur-mc"])).toEqual(NOTHING);
  });

  it("validates only reviewed records: reports and skips a bad reviewed one, ignores a bad unreviewed one", async () => {
    const dir = await mkdtemp(join(tmpdir(), "server-20-scores-skip-"));
    await mkdir(join(dir, "wards"));
    await mkdir(join(dir, "representatives"));
    const badReviewed = { ...reviewedWard(37), area_km2: { value: -1 } };
    const badUnreviewed = { id: "x", review_status: "unreviewed" };
    const good = reviewedWard(38, { area_km2: { ...PROVENANCE, value: 1.5 } });
    await writeFile(join(dir, "wards", "jodhpur.json"), JSON.stringify({ records: [badReviewed, badUnreviewed, good] }));
    await writeFile(join(dir, "representatives", "local_bodies.json"), JSON.stringify([{ id: "jodhpur-mc", towns: ["Jodhpur"] }]));
    const source = await load(dir);
    expect((await source.factsFor(wardArea(38), [])).areaKm2).toBe(1.5);
    expect((await source.factsFor(wardArea(37), [])).areaKm2).toBeNull();
    const skipped = source.skippedRecords();
    expect(skipped).toEqual([{ file: join(dir, "wards", "jodhpur.json"), recordId: badReviewed.id, error: expect.any(Error) }]);
    expect(skipped[0]?.error.message).toContain("area_km2");
    await rm(dir, { recursive: true, force: true });
  });

  it.each([
    ["a file without records", JSON.stringify([FIXTURE])],
    ["a file that is not JSON", "{"],
  ])("throws InternalDataError for %s", async (_case, text) => {
    const broken = await mkdtemp(join(tmpdir(), "server-20-scores-broken-"));
    await mkdir(join(broken, "wards"));
    await writeFile(join(broken, "wards", "bad.json"), text);
    await expect(load(broken)).rejects.toThrow(InternalDataError);
    await rm(broken, { recursive: true, force: true });
  });
});

describe("ScoresSettings", () => {
  const tables = { SITES_TABLE: "junksnap-dev-sites", REPORTS_TABLE: "junksnap-dev-reports", SCORES_TABLE: "junksnap-dev-scores" };

  it("reads the three tables and an optional ASSETS_DIR", () => {
    expect(ScoresSettings.fromEnv(tables)).toMatchObject({ scoresTable: "junksnap-dev-scores", assetsDir: null });
    expect(ScoresSettings.fromEnv({ ...tables, ASSETS_DIR: "/app/data" }).assetsDir).toBe("/app/data");
  });

  it("names the missing variable", () => {
    expect(() => ScoresSettings.fromEnv({ ...tables, REPORTS_TABLE: undefined })).toThrow(/REPORTS_TABLE/);
  });
});
