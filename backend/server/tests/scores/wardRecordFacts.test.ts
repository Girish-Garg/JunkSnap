import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WardRecordAreaFacts } from "../../src/adapters/WardRecordAreaFacts.js";
import { AreaKey } from "../../src/domain/AreaKey.js";
import { InternalDataError } from "../../src/domain/errors.js";
import { GeoPoint } from "../../src/domain/GeoPoint.js";
import { ScoresSettings } from "../../src/settings/ScoresSettings.js";

const SOURCE = { url: "https://www.openstreetmap.org/node/1", fetched_at: "2026-10-10T01:00:00Z", page_sha256: "0".repeat(64) };

function wardRecord(wardId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ward_id: wardId,
    local_body_id: "jodhpur-south-mc",
    area_km2: { value: 2.5, source: SOURCE },
    assembly_seat_id: { value: "s20-ac-127", source: SOURCE },
    loksabha_seat_id: { value: "s20-pc-16", source: SOURCE },
    disposal_points: [{ kind: "collection_point", name: null, lat: 26.2589, lon: 73.0071, source: SOURCE }],
    sensitive_places: [
      { kind: "school", name: null, osm_ref: "way/1", geometry: { type: "Point", coordinates: [73.0042, 26.2614] }, source: SOURCE },
    ],
    review: { status: "reviewed", reviewed_at: "2026-10-10T01:20:00Z" },
    ...overrides,
  };
}

let assets: string;

beforeAll(async () => {
  assets = await mkdtemp(join(tmpdir(), "server-20-scores-assets-"));
  await mkdir(join(assets, "wards"));
  const drain = { kind: "open_drain", name: null, osm_ref: "way/2", geometry: { type: "LineString", coordinates: [[73.0, 26.26], [73.01, 26.26]] }, source: SOURCE };
  const records = [
    wardRecord("jodhpur-south-mc-w37"),
    wardRecord("jodhpur-south-mc-w38", { area_km2: { value: null, source: null }, disposal_points: [], sensitive_places: [drain] }),
    wardRecord("jodhpur-south-mc-w39", { review: { status: "pending", reviewed_at: null } }),
  ];
  await writeFile(join(assets, "wards", "jodhpur.json"), JSON.stringify(records));
  await writeFile(join(assets, "wards", "notes.txt"), "not a ward file");
});

afterAll(async () => {
  await rm(assets, { recursive: true, force: true });
});

describe("WardRecordAreaFacts", () => {
  it("gives a ward its km², disposal points and sensitive places", async () => {
    const facts = await (await WardRecordAreaFacts.fromDirectory(assets)).factsFor(AreaKey.parse("ward", "jodhpur-south-mc-w37"));
    expect(facts.areaKm2).toBe(2.5);
    expect(facts.disposalPoints).toEqual([new GeoPoint(26.2589, 73.0071)]);
    expect(facts.sensitivePlaces.map((place) => place.kind)).toEqual(["school"]);
    expect(facts.sensitivePlaces[0]?.distanceFrom(new GeoPoint(26.2614, 73.0042))).toBeCloseTo(0, 6);
  });

  it("leaves a missing km² null and ignores records still pending review", async () => {
    const source = await WardRecordAreaFacts.fromDirectory(assets);
    expect((await source.factsFor(AreaKey.parse("ward", "jodhpur-south-mc-w38"))).areaKm2).toBeNull();
    const pending = await source.factsFor(AreaKey.parse("ward", "jodhpur-south-mc-w39"));
    expect(pending).toEqual({ areaKm2: null, disposalPoints: [], sensitivePlaces: [] });
  });

  it("gives a seat only the places of its reviewed wards, never km² or disposal points", async () => {
    const facts = await (await WardRecordAreaFacts.fromDirectory(assets)).factsFor(AreaKey.parse("assembly", "s20-ac-127"));
    expect(facts.areaKm2).toBeNull();
    expect(facts.disposalPoints).toEqual([]);
    expect(facts.sensitivePlaces.map((place) => place.kind)).toEqual(["school", "open_drain"]);
  });

  it.each([null, "missing-folder"])("knows nothing when ASSETS_DIR is %s", async (dir) => {
    const source = await WardRecordAreaFacts.fromDirectory(dir === null ? null : join(assets, dir));
    expect(await source.factsFor(AreaKey.parse("ward", "jodhpur-south-mc-w37"))).toEqual({ areaKm2: null, disposalPoints: [], sensitivePlaces: [] });
  });

  it("throws InternalDataError for a ward file that breaks the shape", async () => {
    const broken = await mkdtemp(join(tmpdir(), "server-20-scores-broken-"));
    await mkdir(join(broken, "wards"));
    await writeFile(join(broken, "wards", "bad.json"), JSON.stringify([{ ward_id: "x" }]));
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
