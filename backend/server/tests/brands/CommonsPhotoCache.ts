import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

// Wikimedia asks for a descriptive agent with a contact point and throttles bursts with 429 and Retry-After.
const USER_AGENT = "JunkSnapBrandPrecision/1.0 (hackathon test run; https://github.com/Girish-Garg/saboot)";
const MAX_TRIES = 6;
const MAX_WAIT_S = 120;

export interface PhotoSource {
  readonly id: string;
  readonly url: string;
  readonly sha256: string;
}

// Downloads each photo once into the OS temp folder, outside the repo, and refuses bytes that don't match the manifest.
export class CommonsPhotoCache {
  readonly #folder: string;

  constructor(folder = join(tmpdir(), "junksnap-brand-precision")) {
    this.#folder = folder;
  }

  async bytes(photo: PhotoSource): Promise<Uint8Array> {
    const path = join(this.#folder, `${photo.id}.jpg`);
    const cached = await readFile(path).catch(() => undefined);
    if (cached !== undefined && CommonsPhotoCache.#sha256(cached) === photo.sha256) {
      return cached;
    }
    const fetched = await this.#download(photo.url);
    if (CommonsPhotoCache.#sha256(fetched) !== photo.sha256) {
      throw new Error(`${photo.id}: downloaded bytes do not match the manifest sha256`);
    }
    await mkdir(this.#folder, { recursive: true });
    await writeFile(path, fetched);
    return fetched;
  }

  async #download(url: string): Promise<Uint8Array> {
    for (let attempt = 1; attempt <= MAX_TRIES; attempt += 1) {
      const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
      if (response.ok) {
        return new Uint8Array(await response.arrayBuffer());
      }
      if (response.status !== 429) {
        throw new Error(`${url}: HTTP ${String(response.status)}`);
      }
      const waitS = Math.min(Number(response.headers.get("retry-after")) || 30 * attempt, MAX_WAIT_S);
      await sleep(waitS * 1000);
    }
    throw new Error(`${url}: still rate limited after ${String(MAX_TRIES)} tries`);
  }

  static #sha256(bytes: Uint8Array): string {
    return createHash("sha256").update(bytes).digest("hex");
  }
}
