import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WardRecordAreaFacts } from "../../src/adapters/WardRecordAreaFacts.js";
import type { WardRecord } from "../../src/contracts/index.gen.js";
import { AreaKey } from "../../src/domain/AreaKey.js";
import { InternalDataError } from "../../src/domain/errors.js";
import { GeoPoint } from "../../src/domain/GeoPoint.js";
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
const NOTHING = { areaKm2: null, disposalPoints: [], placesMapped: false };

function reviewedWard(number: number, extra: Partial<WardRecord> = {}): WardRecord {
  const id = `jodhpur-uttar-${String(number).padStart(3, "0")}`;
  return { ...FIXTURE, id, ward_number: { ...FIXTURE.ward_number, value: number }, review_status: "reviewed", ...extra };
}

const wardArea = (number: number) => AreaKey.parse("ward", `jodhpur-mc-w${number}`);

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
  const records = [FIXTURE, measured, reviewedWard(12), reviewedWard(12, { id: "jodhpur-dakshin-012" })];
  await writeJson("wards/jodhpur.json", { records, map_layers: { school: LAYER, water: LAYER, disposal: LAYER } });
  await writeJson("wards/jaipur.json", { records: [], map_layers: { disposal: LAYER } });
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
  it("never uses the unreviewed contract fixture record", async () => {
    expect(FIXTURE.review_status).not.toBe("reviewed");
    const facts = await (await WardRecordAreaFacts.fromDirectory(assets)).factsFor(wardArea(FIXTURE.ward_number.value), []);
    expect(facts).toEqual(NOTHING);
  });

  it("joins a ward area on its local body's city and ward number for km² and disposal points", async () => {
    const facts = await (await WardRecordAreaFacts.fromDirectory(assets)).factsFor(wardArea(37), ["jodhpur-mc"]);
    expect(facts).toEqual({ areaKm2: 2.5, disposalPoints: [new GeoPoint(26.2589, 73.0071)], placesMapped: true });
  });

  it("treats a ward number that two reviewed records share as unknown", async () => {
    const facts = await (await WardRecordAreaFacts.fromDirectory(assets)).factsFor(wardArea(12), ["jodhpur-mc"]);
    expect(facts).toEqual({ ...NOTHING, placesMapped: true });
  });

  it("gives seats no km² or disposal points, only whether their cities have school or water layers", async () => {
    const source = await WardRecordAreaFacts.fromDirectory(assets);
    const seat = AreaKey.parse("assembly", "s20-ac-128");
    expect(await source.factsFor(seat, ["jodhpur-mc"])).toEqual({ ...NOTHING, placesMapped: true });
    expect(await source.factsFor(seat, ["jaipur-mc"])).toEqual(NOTHING);
    expect(await source.factsFor(seat, ["unknown-mc"])).toEqual(NOTHING);
  });

  it.each([null, "missing-folder"])("knows nothing when ASSETS_DIR is %s", async (dir) => {
    const source = await WardRecordAreaFacts.fromDirectory(dir === null ? null : join(assets, dir));
    expect(await source.factsFor(wardArea(37), ["jodhpur-mc"])).toEqual(NOTHING);
  });

  it.each([
    ["a record that breaks ward_record", JSON.stringify({ records: [{ id: "x" }] })],
    ["a file without records", JSON.stringify([FIXTURE])],
    ["a file that is not JSON", "{"],
  ])("throws InternalDataError for %s", async (_case, text) => {
    const broken = await mkdtemp(join(tmpdir(), "server-20-scores-broken-"));
    await mkdir(join(broken, "wards"));
    await writeFile(join(broken, "wards", "bad.json"), text);
    await expect(WardRecordAreaFacts.fromDirectory(broken)).rejects.toThrow(InternalDataError);
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
