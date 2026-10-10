import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ScratchSpace } from "../ports/ScratchSpace.js";

export class TempScratchSpace implements ScratchSpace {
  readonly #root: string;

  constructor(root: string = tmpdir()) {
    this.#root = root;
  }

  create(label: string): Promise<string> {
    return mkdtemp(join(this.#root, `junksnap-${label}-`));
  }

  read(path: string): Promise<Uint8Array> {
    return readFile(path);
  }

  remove(dir: string): Promise<void> {
    return rm(dir, { recursive: true, force: true });
  }
}
