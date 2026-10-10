import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { z } from "zod";
import type { KnownBin } from "../domain/bins/KnownBin.js";
import { InternalDataError } from "../domain/errors.js";
import { GeoPoint } from "../domain/sites/GeoPoint.js";
import type { AssetReader } from "../ports/AssetReader.js";
import type { BinData, BinSource } from "../ports/BinSource.js";

const WARDS = "wards";
const DISPOSAL = "disposal";

const Provenance = {
  source_url: z.string().regex(/^https?:\/\//),
  fetched_at: z.string(),
  page_sha256: z.string().regex(/^[0-9a-f]{64}$/),
};
const Layer = z.object({
  kind: z.literal(DISPOSAL),
  ...Provenance,
  features: z.array(z.object({ ref: z.string().min(1), coords: z.array(z.tuple([z.number(), z.number()])).min(1) })),
});
const Point = z.object({ lat: z.number(), lon: z.number(), ref: z.string().min(1), ...Provenance });
const ReviewedRecord = z.object({ review_status: z.literal("reviewed"), disposal_points: z.array(Point).nullish() });
const CityFile = z.object({ records: z.array(z.unknown()).nullish(), map_layers: z.array(z.unknown()).nullish() });

type Source = KnownBin["source"];

// The crawler's disposal layer (OSM waste disposal, recycling, transfer stations) plus reviewed ward disposal points.
export class FileBinSource implements BinSource {
  readonly #reader: AssetReader;
  readonly #assetsDir: string;

  constructor(reader: AssetReader, assetsDir: string) {
    this.#reader = reader;
    this.#assetsDir = assetsDir;
  }

  async load(): Promise<BinData> {
    const files = await this.#cityFiles();
    const cities = await Promise.all(files.map((file) => this.#city(file)));
    return {
      bins: cities.flatMap((city) => city.bins),
      mappedTowns: cities.filter((city) => city.mapped).map((city) => city.town),
    };
  }

  async #cityFiles(): Promise<string[]> {
    try {
      const names = await readdir(join(this.#assetsDir, WARDS));
      return names.filter((name) => name.endsWith(".json")).sort().map((name) => `${WARDS}/${name}`);
    } catch {
      return [];
    }
  }

  async #city(file: string): Promise<{ town: string; mapped: boolean; bins: KnownBin[] }> {
    const city = CityFile.safeParse(await this.#reader.readJson(file));
    if (!city.success) {
      throw new InternalDataError(`${file} is not a ward city file`);
    }
    const layers = (city.data.map_layers ?? []).flatMap((raw) => FileBinSource.#parsed(Layer, raw));
    const records = (city.data.records ?? []).flatMap((raw) => FileBinSource.#parsed(ReviewedRecord, raw));
    const bins = [...layers.flatMap(FileBinSource.#layerBins), ...records.flatMap(FileBinSource.#recordBins)];
    // An empty disposal layer proves nothing, so a town is mapped only when it has at least one known bin.
    return { town: basename(file, ".json"), mapped: bins.length > 0, bins };
  }

  // Other layers and unreviewed records are not bins; they are skipped, not errors.
  static #parsed<T>(schema: z.ZodType<T>, raw: unknown): T[] {
    const parsed = schema.safeParse(raw);
    return parsed.success ? [parsed.data] : [];
  }

  static #layerBins(layer: z.output<typeof Layer>): KnownBin[] {
    const source: Source = { source_url: layer.source_url, fetched_at: layer.fetched_at, page_sha256: layer.page_sha256 };
    return layer.features.map((feature) => ({ point: FileBinSource.#centre(feature.coords), ref: feature.ref, source }));
  }

  static #recordBins(record: z.output<typeof ReviewedRecord>): KnownBin[] {
    return (record.disposal_points ?? []).map((point) => ({
      point: new GeoPoint(point.lat, point.lon),
      ref: point.ref,
      source: { source_url: point.source_url, fetched_at: point.fetched_at, page_sha256: point.page_sha256 },
    }));
  }

  // coords are [lat, lon]; an area's vertices average to a point inside it for small shapes.
  static #centre(coords: readonly (readonly [number, number])[]): GeoPoint {
    const lat = coords.reduce((total, [pointLat]) => total + pointLat, 0) / coords.length;
    const lon = coords.reduce((total, [, pointLon]) => total + pointLon, 0) / coords.length;
    return new GeoPoint(lat, lon);
  }
}
