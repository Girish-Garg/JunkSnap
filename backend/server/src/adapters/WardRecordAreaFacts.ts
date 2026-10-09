import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { AreaFactSheet } from "../domain/AreaFactSheet.js";
import type { AreaKey, AreaKind } from "../domain/AreaKey.js";
import { InternalDataError } from "../domain/errors.js";
import { GeoPoint } from "../domain/GeoPoint.js";
import { PLACE_KINDS, SensitivePlace } from "../domain/SensitivePlace.js";
import type { AreaFacts } from "../ports/AreaFacts.js";

const position = z.tuple([z.number(), z.number()]);
const Geometry = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Point"), coordinates: position }),
  z.object({ type: z.literal("LineString"), coordinates: z.array(position).min(2) }),
  z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(position).min(4)).min(1) }),
]);

// The fields of ward_record (contracts v1.1, PR #25) that area scores read.
const WardRecord = z.object({
  ward_id: z.string(),
  area_km2: z.object({ value: z.number().nullable() }),
  assembly_seat_id: z.object({ value: z.string().nullable() }),
  loksabha_seat_id: z.object({ value: z.string().nullable() }),
  disposal_points: z.array(z.object({ lat: z.number(), lon: z.number() })),
  sensitive_places: z.array(z.object({ kind: z.enum(PLACE_KINDS), geometry: Geometry })),
  review: z.object({ status: z.enum(["pending", "reviewed"]) }),
});

type WardRecordShape = z.output<typeof WardRecord>;

interface WardFacts {
  readonly areaIds: Readonly<Record<AreaKind, string | null>>;
  readonly areaKm2: number | null;
  readonly disposalPoints: readonly GeoPoint[];
  readonly places: readonly SensitivePlace[];
}

// Reviewed ward records from <ASSETS_DIR>/wards/*.json; v1 has km² and disposal points for wards only.
export class WardRecordAreaFacts implements AreaFacts {
  readonly #wards: readonly WardFacts[];

  private constructor(wards: readonly WardFacts[]) {
    this.#wards = wards;
  }

  static async fromDirectory(assetsDir: string | null): Promise<WardRecordAreaFacts> {
    const dir = assetsDir === null ? null : join(assetsDir, "wards");
    const files = dir === null ? [] : await WardRecordAreaFacts.#jsonFiles(dir);
    const records = (await Promise.all(files.map((file) => WardRecordAreaFacts.#read(file)))).flat();
    const reviewed = records.filter((record) => record.review.status === "reviewed");
    return new WardRecordAreaFacts(reviewed.map((record) => WardRecordAreaFacts.#facts(record)));
  }

  async factsFor(area: AreaKey): Promise<AreaFactSheet> {
    const wards = this.#wards.filter((ward) => ward.areaIds[area.kind] === area.id);
    const ward = area.kind === "ward" ? wards[0] : undefined;
    return {
      areaKm2: ward?.areaKm2 ?? null,
      disposalPoints: ward?.disposalPoints ?? [],
      sensitivePlaces: wards.flatMap((each) => each.places),
    };
  }

  static async #jsonFiles(dir: string): Promise<string[]> {
    try {
      const names = await readdir(dir);
      return names.filter((name) => name.endsWith(".json")).sort().map((name) => join(dir, name));
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return [];
      }
      throw new InternalDataError(`cannot list ward records in ${dir}`, { cause: error });
    }
  }

  static async #read(file: string): Promise<WardRecordShape[]> {
    const parsed = z.array(WardRecord).safeParse(JSON.parse(await readFile(file, "utf8")));
    if (!parsed.success) {
      throw new InternalDataError(`${file}: ${z.prettifyError(parsed.error)}`);
    }
    return parsed.data;
  }

  static #facts(record: WardRecordShape): WardFacts {
    const km2 = record.area_km2.value;
    return {
      areaIds: {
        ward: record.ward_id,
        assembly: record.assembly_seat_id.value,
        loksabha: record.loksabha_seat_id.value,
        district: null,
      },
      areaKm2: km2 !== null && km2 > 0 ? km2 : null,
      disposalPoints: record.disposal_points.map((point) => new GeoPoint(point.lat, point.lon)),
      places: record.sensitive_places.map(({ kind, geometry }) => WardRecordAreaFacts.#place(kind, geometry)),
    };
  }

  static #place(kind: SensitivePlace["kind"], geometry: z.output<typeof Geometry>): SensitivePlace {
    switch (geometry.type) {
      case "Point":
        return new SensitivePlace(kind, [[geometry.coordinates]], false);
      case "LineString":
        return new SensitivePlace(kind, [geometry.coordinates], false);
      case "Polygon":
        return new SensitivePlace(kind, geometry.coordinates, true);
    }
  }
}
