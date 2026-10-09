import { z } from "zod";
import { InternalDataError } from "../../domain/errors.js";
import { LocalBody } from "../../domain/location/LocalBody.js";
import type { Representative } from "../../domain/location/Seats.js";
import type { AssetReader } from "../../ports/AssetReader.js";
import type { SeatLocator } from "../../ports/location/SeatLocator.js";
import {
  AssemblyCollection,
  LocalBodyRows,
  LokSabhaCollection,
  RepresentativeRows,
} from "./locationAssetSchemas.js";
import { TurfSeatLocator } from "./TurfSeatLocator.js";

const FILES = {
  assembly: "boundaries/rajasthan_assembly.geojson",
  lokSabha: "boundaries/india_loksabha.geojson",
  localBodies: "representatives/local_bodies.json",
  representatives: ["representatives/rajasthan_mla_seats.json", "representatives/india_mp_seats.json"],
} as const;

// The version data/boundaries/SOURCES.md names for the two seat files.
const BOUNDARIES_VERSION = "eci-2008-delimitation/v1";

export class LocationAssetLoader {
  readonly #reader: AssetReader;

  constructor(reader: AssetReader) {
    this.#reader = reader;
  }

  async loadSeats(): Promise<SeatLocator> {
    const [assembly, lokSabha] = await Promise.all([
      this.#read(FILES.assembly, AssemblyCollection),
      this.#read(FILES.lokSabha, LokSabhaCollection),
    ]);
    return new TurfSeatLocator({
      version: BOUNDARIES_VERSION,
      assembly: assembly.features.map(({ geometry, properties: { id, name, pc_id } }) => ({
        geometry,
        value: { id, name, lokSabhaId: pc_id },
      })),
      lokSabha: lokSabha.features.map(({ geometry, properties }) => ({ geometry, value: properties })),
    });
  }

  async loadLocalBodies(): Promise<LocalBody[]> {
    const rows = await this.#read(FILES.localBodies, LocalBodyRows);
    return rows.map((row) => new LocalBody(row));
  }

  async loadRepresentatives(): Promise<Representative[]> {
    const files = await Promise.all(FILES.representatives.map((path) => this.#read(path, RepresentativeRows)));
    return files.flat();
  }

  async #read<S extends z.ZodType>(path: string, schema: S): Promise<z.output<S>> {
    const result = schema.safeParse(await this.#reader.readJson(path));
    if (!result.success) {
      throw new InternalDataError(`asset ${path} has the wrong shape: ${z.prettifyError(result.error)}`);
    }
    return result.data;
  }
}
