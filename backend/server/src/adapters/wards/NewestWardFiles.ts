import type { WardFile, WardFileSource } from "../../ports/WardFileSource.js";
import { readWardFile } from "./readWardFile.js";

interface Dated {
  readonly file: WardFile;
  readonly reviewed: number;
  readonly generatedAt: number;
}

// Per city, the file with more reviewed records (crawl output is always unreviewed), then the newest generated_at;
// a tie or an unreadable date keeps the earlier source, so pass the image's files first.
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
    const better = kept === undefined || candidate.reviewed > kept.reviewed
      || (candidate.reviewed === kept.reviewed && candidate.generatedAt > kept.generatedAt);
    if (better) {
      newest.set(candidate.file.city, candidate);
    }
  }

  // An unreadable file or date counts as oldest; the reader that loads the file reports what is wrong with it.
  static async #dated(file: WardFile): Promise<Dated> {
    try {
      const body = await readWardFile(file.path);
      const value: unknown = typeof body === "object" && body !== null ? Reflect.get(body, "generated_at") : undefined;
      const time = typeof value === "string" ? Date.parse(value) : Number.NaN;
      return { file, reviewed: NewestWardFiles.#reviewed(body), generatedAt: Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time };
    } catch {
      return { file, reviewed: 0, generatedAt: Number.NEGATIVE_INFINITY };
    }
  }

  static #reviewed(body: unknown): number {
    const records: unknown = typeof body === "object" && body !== null ? Reflect.get(body, "records") : undefined;
    if (!Array.isArray(records)) {
      return 0;
    }
    return records.filter((record: unknown) => typeof record === "object" && record !== null && Reflect.get(record, "review_status") === "reviewed").length;
  }
}
