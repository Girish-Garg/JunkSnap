import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Temporary folders for one test file, removed together afterwards: call removeAll() from afterAll.
export class TempDirs {
  readonly #made: string[] = [];

  make(prefix: string): string {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    this.#made.push(dir);
    return dir;
  }

  removeAll(): void {
    for (const dir of this.#made.splice(0)) {
      // Windows can hold a just-closed file for a moment; retry instead of leaking the folder.
      rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  }
}
