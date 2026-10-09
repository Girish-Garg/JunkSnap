import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FileAssetReader } from "../../src/adapters/FileAssetReader.js";
import { LocationAssetLoader } from "../../src/adapters/location/LocationAssetLoader.js";
import { InternalDataError } from "../../src/domain/errors.js";
import { GeoPoint } from "../../src/domain/location/GeoPoint.js";
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

  it("indexes Polygon and MultiPolygon seats, keeping only id, name and status", async () => {
    const seats = await loader.loadSeats();
    expect(seats.boundariesVersion).toBe("eci-2008-delimitation/v1");
    expect(seats.assemblySeatAt(GeoPoint.of(26.2618, 73.0035))).toEqual({ id: "s20-ac-128", name: "Jodhpur" });
    expect(seats.assemblySeatAt(GeoPoint.of(26.3049, 73.0352))?.id).toBe("s20-ac-127");
    expect(seats.assemblySeatAt(GeoPoint.of(26.2701, 73.0458))?.id).toBe("s20-ac-127");
    expect(seats.lokSabhaSeatAt(GeoPoint.of(34.1526, 77.5771))).toEqual({
      id: "u09-pc-1",
      name: "Ladakh",
      status: "outdated",
    });
  });

  it("reads both representative files", async () => {
    const rows = await loader.loadRepresentatives();
    expect(rows.filter((row) => row.office === "mla")).toHaveLength(3);
    expect(rows.filter((row) => row.office === "mp")).toHaveLength(4);
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
