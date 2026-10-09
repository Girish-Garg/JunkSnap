import { writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { NotFoundError } from "../../src/domain/errors.js";
import type { ImageStore } from "../../src/ports/moderation/ImageStore.js";

// Serves originals from memory and writes public copies into a local folder.
export class LocalImageStore implements ImageStore {
  readonly #originals = new Map<string, Uint8Array>();
  readonly #outDir: string;

  constructor(outDir: string) {
    this.#outDir = outDir;
  }

  put(key: string, bytes: Uint8Array): void {
    this.#originals.set(key, bytes);
  }

  async readOriginal(key: string, maxBytes: number): Promise<Uint8Array | null> {
    const bytes = this.#originals.get(key);
    if (bytes === undefined) {
      throw new NotFoundError(`no original at ${key}`);
    }
    return bytes.byteLength > maxBytes ? null : bytes;
  }

  async writePublic(key: string, jpeg: Uint8Array): Promise<void> {
    await writeFile(join(this.#outDir, basename(key)), jpeg);
  }
}
