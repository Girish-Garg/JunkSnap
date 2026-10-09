import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FileAssetReader } from "../../src/adapters/FileAssetReader.js";
import { LocationAssetLoader } from "../../src/adapters/location/LocationAssetLoader.js";
import { InternalDataError } from "../../src/domain/errors.js";
import { GeoPoint } from "../../src/domain/GeoPoint.js";
import type { AssetReader } from "../../src/ports/AssetReader.js";

const FIXTURES = fileURLToPath(new URL("fixtures/", import.meta.url));

class FakeAssetReader implements AssetReader {
  readonly #files: Readonly<Record<string, unknown>>;

  constructor(files: Readonly<Record<string, unknown>>) {
    this.#files = files;
  }

  async readJson(path: string): Promise<unknown> {
    return this.#files[path];
  }

  async readText(path: string): Promise<string> {
    return JSON.stringify(this.#files[path]);
  }

  async readBytes(path: string): Promise<Uint8Array> {
    return new TextEncoder().encode(await this.readText(path));
  }
}

describe("LocationAssetLoader", () => {
  const loader = new LocationAssetLoader(new FileAssetReader(FIXTURES));

  it("indexes Polygon and MultiPolygon seats, keeping id, name, pc_id, state and status", async () => {
    const seats = await loader.loadSeats();
    const ids = (lat: number, lon: number) => seats.assemblySeatsNear(new GeoPoint(lat, lon), 0).map((seat) => seat.id);
    expect(seats.boundariesVersion).toBe("eci-2008-delimitation/v1");
    expect(seats.assemblySeatsNear(new GeoPoint(26.2618, 73.0035), 0)).toEqual([
      { id: "s20-ac-128", name: "Jodhpur", lokSabhaId: "s20-pc-16" },
    ]);
    expect(ids(26.3049, 73.0352)).toEqual(["s20-ac-127"]);
    expect(ids(26.2701, 73.0458)).toEqual(["s20-ac-127"]);
    expect(seats.lokSabhaSeatsNear(new GeoPoint(34.1526, 77.5771), 0)).toEqual([
      { id: "u09-pc-1", name: "Ladakh", state: "Ladakh", status: "outdated" },
    ]);
    expect(seats.lokSabhaSeat("s20-pc-7")).toEqual({ id: "s20-pc-7", name: "Jaipur", state: "Rajasthan", status: "current" });
    expect(seats.lokSabhaSeat("s99-pc-1")).toBeNull();
  });

  it("lists every containing seat in file order, then seats whose edge is within the distance", async () => {
    const seats = await loader.loadSeats();
    const lokSabha = (lat: number, lon: number) =>
      seats.lokSabhaSeatsNear(new GeoPoint(lat, lon), 1_000).map((seat) => seat.id);
    const inNotch = new GeoPoint(26.27, 73.012);
    expect(seats.assemblySeatsNear(inNotch, 0)).toEqual([]);
    expect(seats.assemblySeatsNear(inNotch, 1_000).map((seat) => seat.id)).toEqual(["s20-ac-128"]);
    expect(seats.assemblySeatsNear(inNotch, 500)).toEqual([]);
    expect(lokSabha(29.95, 74.39)).toEqual(["s19-pc-10", "s20-pc-1"]);
    expect(lokSabha(27.005, 75.85)).toEqual(["s20-pc-7"]);
    expect(lokSabha(27.02, 75.85)).toEqual([]);
  });

  it("reads both representative files", async () => {
    const rows = await loader.loadRepresentatives();
    expect(rows.filter((row) => row.office === "mla")).toHaveLength(4);
    expect(rows.filter((row) => row.office === "mp")).toHaveLength(6);
  });

  it.each([
    ["representatives/local_bodies.json", [{ id: "Jodhpur MC", name: "x", head_office: "x", state: "x", towns: [] }]],
    ["representatives/rajasthan_mla_seats.json", [{ office: "mla", seat_id: "s20-ac-1", as_of: "today", source: "x" }]],
  ])("rejects %s when a row breaks the contract", async (path, rows) => {
    const bad = new LocationAssetLoader(new FakeAssetReader({ [path]: rows, "representatives/india_mp_seats.json": [] }));
    const load = path.endsWith("local_bodies.json") ? bad.loadLocalBodies() : bad.loadRepresentatives();
    await expect(load).rejects.toThrow(InternalDataError);
    await expect(load).rejects.toThrow(path);
  });

  it("rejects a seat file whose status is unknown", async () => {
    const seat = { properties: { id: "s20-pc-16", name: "Jodhpur", status: "new" }, geometry: { type: "Point" } };
    const files = {
      "boundaries/rajasthan_assembly.geojson": { type: "FeatureCollection", features: [] },
      "boundaries/india_loksabha.geojson": { type: "FeatureCollection", features: [seat] },
    };
    await expect(new LocationAssetLoader(new FakeAssetReader(files)).loadSeats()).rejects.toThrow(/india_loksabha/);
  });
});
