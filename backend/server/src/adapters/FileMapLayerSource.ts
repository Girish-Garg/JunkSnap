import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { InternalDataError } from "../domain/errors.js";
import type { MapLayer } from "../domain/MapLayer.js";
import type { AssetReader } from "../ports/AssetReader.js";
import type { MapLayerSource } from "../ports/MapLayerSource.js";

const WARDS = "wards";
const PLACE_KINDS = ["school", "hospital", "water", "drain"] as const;

// The city file has no schema yet (contracts README); only the layer fields used here are checked.
const Layer = z.object({
  kind: z.string(),
  source_url: z.string().regex(/^https?:\/\//),
  fetched_at: z.string(),
  page_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  features: z.array(z.object({
    ref: z.string().regex(/^osm:(node|way|relation)\/[0-9]+$/),
    coords: z.array(z.tuple([z.number(), z.number()])).min(1),
  })),
});
const CityFile = z.object({ map_layers: z.array(z.unknown()).nullish() });

// Reads <ASSETS_DIR>/wards/*.json; no wards folder means no layers, so site.insights.near stays empty.
export class FileMapLayerSource implements MapLayerSource {
  readonly #reader: AssetReader;
  readonly #assetsDir: string;

  constructor(reader: AssetReader, assetsDir: string) {
    this.#reader = reader;
    this.#assetsDir = assetsDir;
  }

  async layers(): Promise<readonly MapLayer[]> {
    const files = await this.#cityFiles();
    const perCity = await Promise.all(files.map((file) => this.#cityLayers(file)));
    return perCity.flat();
  }

  async #cityFiles(): Promise<string[]> {
    try {
      const names = await readdir(join(this.#assetsDir, WARDS));
      return names.filter((name) => name.endsWith(".json")).map((name) => `${WARDS}/${name}`);
    } catch {
      return [];
    }
  }

  async #cityLayers(file: string): Promise<MapLayer[]> {
    const city = CityFile.safeParse(await this.#reader.readJson(file));
    if (!city.success) {
      throw new InternalDataError(`${file} is not a ward city file`);
    }
    const layers = (city.data.map_layers ?? []).map((raw) => Layer.safeParse(raw));
    return layers.flatMap((parsed) => (parsed.success ? FileMapLayerSource.#place(parsed.data) : []));
  }

  // Disposal points are not sensitive places; other kinds are skipped.
  static #place(layer: z.output<typeof Layer>): MapLayer[] {
    const kind = PLACE_KINDS.find((known) => known === layer.kind);
    if (kind === undefined) {
      return [];
    }
    const source = { source_url: layer.source_url, fetched_at: layer.fetched_at, page_sha256: layer.page_sha256 };
    return [{ kind, source, features: layer.features }];
  }
}
