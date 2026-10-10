import type { WardFile, WardFileSource } from "../../ports/WardFileSource.js";
import { readWardFile } from "./readWardFile.js";

interface Dated {
  readonly file: WardFile;
  readonly reviewed: number;
  readonly hasLayers: boolean;
  readonly generatedAt: number;
}

// Per city, the file with more reviewed records (crawl output is always unreviewed), then one with map layers over one
// without, then the newest generated_at; a tie or an unreadable date keeps the earlier source, so pass the image's files first.
export class NewestWardFiles implements WardFileSource {
  readonly #sources: readonly WardFileSource[];

  constructor(sources: readonly WardFileSource[]) {
    this.#sources = sources;
  }

  async files(): Promise<readonly WardFile[]> {
    const newest = new Map<string, Dated>();
    for (const source of this.#sources) {
      const dated = await Promise.all((await source.files()).map((file) => NewestWardFiles.#dated(file)));
      dated.forEach((candidate) => NewestWardFiles.#keepNewer(newest, candidate));
    }
    return [...newest.values()].map((each) => each.file).sort((a, b) => a.city.localeCompare(b.city));
  }

  static #keepNewer(newest: Map<string, Dated>, candidate: Dated): void {
    const kept = newest.get(candidate.file.city);
    if (kept === undefined || NewestWardFiles.#beats(candidate, kept)) {
      newest.set(candidate.file.city, candidate);
    }
  }

  static #beats(candidate: Dated, kept: Dated): boolean {
    if (candidate.reviewed !== kept.reviewed) {
      return candidate.reviewed > kept.reviewed;
    }
    if (candidate.hasLayers !== kept.hasLayers) {
      return candidate.hasLayers;
    }
    return candidate.generatedAt > kept.generatedAt;
  }

  // An unreadable file or date counts as oldest; the reader that loads the file reports what is wrong with it.
  static async #dated(file: WardFile): Promise<Dated> {
    try {
      const body = await readWardFile(file.path);
      const value: unknown = typeof body === "object" && body !== null ? Reflect.get(body, "generated_at") : undefined;
      const time = typeof value === "string" ? Date.parse(value) : Number.NaN;
      const generatedAt = Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
      return { file, reviewed: NewestWardFiles.#reviewed(body), hasLayers: NewestWardFiles.#hasLayers(body), generatedAt };
    } catch {
      return { file, reviewed: 0, hasLayers: false, generatedAt: Number.NEGATIVE_INFINITY };
    }
  }

  static #hasLayers(body: unknown): boolean {
    const layers: unknown = typeof body === "object" && body !== null ? Reflect.get(body, "map_layers") : undefined;
    return Array.isArray(layers) && layers.length > 0;
  }

  static #reviewed(body: unknown): number {
    const records: unknown = typeof body === "object" && body !== null ? Reflect.get(body, "records") : undefined;
    if (!Array.isArray(records)) {
      return 0;
    }
    return records.filter((record: unknown) => typeof record === "object" && record !== null && Reflect.get(record, "review_status") === "reviewed").length;
  }
}
