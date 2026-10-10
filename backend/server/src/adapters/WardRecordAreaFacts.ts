import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { validateWardRecord, type WardRecord } from "../contracts/index.gen.js";
import type { AreaFactSheet } from "../domain/AreaFactSheet.js";
import type { AreaKey } from "../domain/AreaKey.js";
import { InternalDataError, ValidationError } from "../domain/errors.js";
import type { AreaFacts, SkippedRecord } from "../ports/AreaFacts.js";
import type { WardFile, WardFileSource } from "../ports/WardFileSource.js";
import { DirectoryWardFiles } from "./wards/DirectoryWardFiles.js";
import { readWardFile } from "./wards/readWardFile.js";

// The city file and its map layers have no schema yet (contracts README); each reviewed record must pass ward_record.
const CityFile = z.object({ records: z.array(z.unknown()), map_layers: z.array(z.object({ kind: z.string() })).nullish() });
const Reviewed = z.object({ review_status: z.literal("reviewed") });
const LocalBodies = z.array(z.object({ id: z.string(), towns: z.array(z.string()) }));
const WARD_AREA_ID = /^([a-z0-9-]+)-w([0-9]+)$/;
const PLACE_LAYERS = ["school", "water"];

interface CityWards {
  readonly city: string;
  readonly reviewed: readonly WardRecord[];
  readonly skipped: readonly SkippedRecord[];
  readonly placesMapped: boolean;
}

type Checked = { readonly record: WardRecord } | { readonly skipped: SkippedRecord };

// Ward city files (the image's or newer crawled ones) and <ASSETS_DIR>/representatives/local_bodies.json; km² for wards only (bins come from BinLocator).
export class WardRecordAreaFacts implements AreaFacts {
  readonly #cities: ReadonlyMap<string, CityWards>;
  readonly #bodyCities: ReadonlyMap<string, readonly string[]>;

  private constructor(cities: ReadonlyMap<string, CityWards>, bodyCities: ReadonlyMap<string, readonly string[]>) {
    this.#cities = cities;
    this.#bodyCities = bodyCities;
  }

  static async fromDirectory(assetsDir: string | null): Promise<WardRecordAreaFacts> {
    return WardRecordAreaFacts.fromFiles(new DirectoryWardFiles(join(assetsDir ?? ".", "wards")), assetsDir);
  }

  // Without an assets folder no local body maps to a city, so no ward file could ever match.
  static async fromFiles(source: WardFileSource, assetsDir: string | null): Promise<WardRecordAreaFacts> {
    if (assetsDir === null) {
      return new WardRecordAreaFacts(new Map(), new Map());
    }
    const files = await source.files();
    const cities = await Promise.all(files.map((file) => WardRecordAreaFacts.#readCity(file)));
    const bodies = await WardRecordAreaFacts.#bodyCitiesFrom(join(assetsDir, "representatives", "local_bodies.json"));
    return new WardRecordAreaFacts(new Map(cities.map((city) => [city.city, city])), bodies);
  }

  async factsFor(area: AreaKey, localBodyIds: readonly string[]): Promise<AreaFactSheet> {
    const ward = area.kind === "ward" ? this.#ward(area.id) : null;
    const cities = localBodyIds.flatMap((id) => this.#bodyCities.get(id) ?? []);
    return {
      areaKm2: ward?.area_km2?.value ?? null,
      placesMapped: cities.some((city) => this.#cities.get(city)?.placesMapped === true),
    };
  }

  skippedRecords(): readonly SkippedRecord[] {
    return [...this.#cities.values()].flatMap((city) => city.skipped);
  }

  // A record joins only the ward whose id it carries (same local body and number), so pre-merger bodies never attach; two matches mean unknown.
  #ward(wardId: string): WardRecord | null {
    const match = WARD_AREA_ID.exec(wardId);
    const cities = this.#bodyCities.get(match?.[1] ?? "") ?? [];
    const records = cities.flatMap((city) => this.#cities.get(city)?.reviewed ?? []);
    const found = records.filter((record) => record.id === wardId);
    return found.length === 1 ? (found[0] ?? null) : null;
  }

  static async #readCity(file: WardFile): Promise<CityWards> {
    const parsed = CityFile.safeParse(await readWardFile(file.path));
    if (!parsed.success) {
      throw new InternalDataError(`${file.path}: ${z.prettifyError(parsed.error)}`);
    }
    const reviewed = parsed.data.records.filter((record) => Reviewed.safeParse(record).success);
    const checked = reviewed.map((record) => WardRecordAreaFacts.#check(file.path, record));
    const kinds = (parsed.data.map_layers ?? []).map((layer) => layer.kind);
    return {
      city: file.city,
      reviewed: checked.flatMap((each) => ("record" in each ? [each.record] : [])),
      skipped: checked.flatMap((each) => ("skipped" in each ? [each.skipped] : [])),
      placesMapped: PLACE_LAYERS.some((kind) => kinds.includes(kind)),
    };
  }

  // A reviewed record that breaks ward_record is left out, so one bad row never stops the job; anything else still does.
  static #check(file: string, record: unknown): Checked {
    try {
      return { record: validateWardRecord(record) };
    } catch (error) {
      if (!(error instanceof ValidationError)) {
        throw error;
      }
      const recordId = z.object({ id: z.string() }).safeParse(record).data?.id ?? "unknown";
      return { skipped: { file, recordId, error } };
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
