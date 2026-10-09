import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { z } from "zod";
import { validateWardRecord, type WardRecord } from "../contracts/index.gen.js";
import type { AreaFactSheet } from "../domain/AreaFactSheet.js";
import type { AreaKey } from "../domain/AreaKey.js";
import { InternalDataError } from "../domain/errors.js";
import { GeoPoint } from "../domain/GeoPoint.js";
import type { AreaFacts } from "../ports/AreaFacts.js";

// The city file and its map layers have no schema yet (contracts README); each record must pass ward_record.
const CityFile = z.object({ records: z.array(z.unknown()), map_layers: z.record(z.string(), z.unknown()).nullish() });
const LocalBodies = z.array(z.object({ id: z.string(), towns: z.array(z.string()) }));
const WARD_AREA_ID = /^([a-z0-9-]+)-w([0-9]+)$/;
const PLACE_LAYERS = ["school", "water"];

interface CityWards {
  readonly city: string;
  readonly reviewed: readonly WardRecord[];
  readonly placesMapped: boolean;
}

// <ASSETS_DIR>/wards/<city>.json and representatives/local_bodies.json; v1 has km² and disposal points for wards only.
export class WardRecordAreaFacts implements AreaFacts {
  readonly #cities: ReadonlyMap<string, CityWards>;
  readonly #bodyCities: ReadonlyMap<string, readonly string[]>;

  private constructor(cities: ReadonlyMap<string, CityWards>, bodyCities: ReadonlyMap<string, readonly string[]>) {
    this.#cities = cities;
    this.#bodyCities = bodyCities;
  }

  static async fromDirectory(assetsDir: string | null): Promise<WardRecordAreaFacts> {
    if (assetsDir === null) {
      return new WardRecordAreaFacts(new Map(), new Map());
    }
    const files = await WardRecordAreaFacts.#jsonFiles(join(assetsDir, "wards"));
    const cities = await Promise.all(files.map((file) => WardRecordAreaFacts.#readCity(file)));
    const bodies = await WardRecordAreaFacts.#bodyCitiesFrom(join(assetsDir, "representatives", "local_bodies.json"));
    return new WardRecordAreaFacts(new Map(cities.map((city) => [city.city, city])), bodies);
  }

  async factsFor(area: AreaKey, localBodyIds: readonly string[]): Promise<AreaFactSheet> {
    const ward = area.kind === "ward" ? this.#ward(area.id) : null;
    const cities = localBodyIds.flatMap((id) => this.#bodyCities.get(id) ?? []);
    return {
      areaKm2: ward?.area_km2?.value ?? null,
      disposalPoints: (ward?.disposal_points ?? []).map((point) => new GeoPoint(point.lat, point.lon)),
      placesMapped: cities.some((city) => this.#cities.get(city)?.placesMapped === true),
    };
  }

  // Joins <local-body-id>-w<n> on the body's cities and ward_number; old bodies can repeat a number, so two matches mean unknown.
  #ward(wardId: string): WardRecord | null {
    const match = WARD_AREA_ID.exec(wardId);
    const cities = this.#bodyCities.get(match?.[1] ?? "") ?? [];
    const records = cities.flatMap((city) => this.#cities.get(city)?.reviewed ?? []);
    const found = records.filter((record) => record.ward_number.value === Number(match?.[2]));
    return found.length === 1 ? (found[0] ?? null) : null;
  }

  static async #readCity(file: string): Promise<CityWards> {
    const parsed = CityFile.safeParse(await WardRecordAreaFacts.#json(file));
    if (!parsed.success) {
      throw new InternalDataError(`${file}: ${z.prettifyError(parsed.error)}`);
    }
    const records = parsed.data.records.map((record) => WardRecordAreaFacts.#record(file, record));
    const layers = parsed.data.map_layers ?? {};
    return {
      city: basename(file, ".json"),
      reviewed: records.filter((record) => record.review_status === "reviewed"),
      placesMapped: PLACE_LAYERS.some((layer) => (layers[layer] ?? null) !== null),
    };
  }

  static #record(file: string, record: unknown): WardRecord {
    try {
      return validateWardRecord(record);
    } catch (error) {
      throw new InternalDataError(`${file}: a record breaks the ward_record contract`, { cause: error });
    }
  }

  // Local body id to the city slugs of its towns, which name the files in wards/.
  static async #bodyCitiesFrom(file: string): Promise<Map<string, string[]>> {
    const text = await WardRecordAreaFacts.#readIfPresent(file);
    const parsed = LocalBodies.safeParse(text === null ? [] : WardRecordAreaFacts.#parse(file, text));
    if (!parsed.success) {
      throw new InternalDataError(`${file}: ${z.prettifyError(parsed.error)}`);
    }
    const slug = (town: string) => town.trim().toLowerCase().replace(/\s+/g, "-");
    return new Map(parsed.data.map((body) => [body.id, body.towns.map(slug)]));
  }

  static async #jsonFiles(dir: string): Promise<string[]> {
    try {
      const names = await readdir(dir);
      return names.filter((name) => name.endsWith(".json")).sort().map((name) => join(dir, name));
    } catch (error) {
      if (WardRecordAreaFacts.#missing(error)) {
        return [];
      }
      throw new InternalDataError(`cannot list ward files in ${dir}`, { cause: error });
    }
  }

  static async #json(file: string): Promise<unknown> {
    return WardRecordAreaFacts.#parse(file, await readFile(file, "utf8"));
  }

  static async #readIfPresent(file: string): Promise<string | null> {
    try {
      return await readFile(file, "utf8");
    } catch (error) {
      if (WardRecordAreaFacts.#missing(error)) {
        return null;
      }
      throw new InternalDataError(`cannot read ${file}`, { cause: error });
    }
  }

  static #parse(file: string, text: string): unknown {
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new InternalDataError(`${file} is not JSON`, { cause: error });
    }
  }

  static #missing(error: unknown): boolean {
    return error instanceof Error && "code" in error && error.code === "ENOENT";
  }
}
