import { readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { InternalDataError } from "../../domain/errors.js";
import type { WardFile, WardFileSource } from "../../ports/WardFileSource.js";

// <dir>/*.json sorted by name; a missing folder means no ward files.
export class DirectoryWardFiles implements WardFileSource {
  readonly #dir: string;

  constructor(dir: string) {
    this.#dir = resolve(dir);
  }

  async files(): Promise<readonly WardFile[]> {
    const names = await this.#names();
    return names
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map((name) => ({ city: basename(name, ".json"), path: join(this.#dir, name) }));
  }

  async #names(): Promise<string[]> {
    try {
      return await readdir(this.#dir);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return [];
      }
      throw new InternalDataError(`cannot list ward files in ${this.#dir}`, { cause: error });
    }
  }
}
