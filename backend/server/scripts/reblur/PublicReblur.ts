import type { ImageBuckets } from "../../src/adapters/moderation/S3ImageStore.js";
import { BLUR_POLICY } from "../../src/domain/moderation/BlurPlanner.js";
import { PhotoId } from "../../src/domain/moderation/PhotoId.js";
import type { PhotoLoader } from "../../src/services/moderation/PhotoLoader.js";
import type { PrivacyBlur } from "../../src/services/moderation/PrivacyBlur.js";

// What PublicReblur reads; S3Objects in the script, a map in tests.
export interface ObjectSource {
  blurPolicy(bucket: string, key: string): Promise<string | null>;
  read(bucket: string, key: string): Promise<Uint8Array | null>;
}

export interface ReblurParts {
  readonly objects: ObjectSource;
  readonly loader: PhotoLoader;
  // Writes through S3ImageStore, which stamps the current blur policy on every copy.
  readonly blur: PrivacyBlur;
  readonly buckets: ImageBuckets;
}

export interface ReblurOptions {
  readonly dryRun: boolean;
  // Re-blur copies already made under the current policy too.
  readonly force: boolean;
}

export type ReblurAction = "reblurred" | "would_reblur" | "current" | "skipped";

export interface ReblurOutcome {
  readonly key: string;
  readonly action: ReblurAction;
  readonly detail: string;
}

// Re-runs the current blur on one public copy's original and overwrites the copy. Safe to run again:
// copies already stamped with the current policy are left alone unless forced.
export class PublicReblur {
  readonly #parts: ReblurParts;
  readonly #options: ReblurOptions;

  constructor(parts: ReblurParts, options: ReblurOptions) {
    this.#parts = parts;
    this.#options = options;
  }

  async one(key: string): Promise<ReblurOutcome> {
    const photoId = PhotoId.fromBlurredKey(key);
    if (photoId === null) {
      return { key, action: "skipped", detail: "not a blurred photo key" };
    }
    const { objects, buckets } = this.#parts;
    if (!this.#options.force && (await objects.blurPolicy(buckets.public, key)) === BLUR_POLICY) {
      return { key, action: "current", detail: `already ${BLUR_POLICY}` };
    }
    const original = await objects.read(buckets.originals, photoId.privateOriginalKey());
    // Without the original, the old public copy is blurred again: what was blurred stays blurred.
    const bytes = original ?? (await objects.read(buckets.public, key));
    const source = original === null ? "public copy (original missing)" : "original";
    if (bytes === null) {
      return { key, action: "skipped", detail: "neither the original nor the public copy could be read" };
    }
    return this.#options.dryRun ? { key, action: "would_reblur", detail: `from the ${source}` } : this.#reblur(key, photoId, bytes, source);
  }

  async #reblur(key: string, photoId: PhotoId, bytes: Uint8Array, source: string): Promise<ReblurOutcome> {
    const load = await this.#parts.loader.decode(bytes);
    if ("invalid" in load) {
      return { key, action: "skipped", detail: `the ${source} is invalid: ${load.invalid}` };
    }
    const blurred = await this.#parts.blur.blur(load.photo);
    await this.#parts.blur.publish(blurred, photoId);
    const record = blurred.record.toContract();
    return { key, action: "reblurred", detail: `from the ${source}: ${JSON.stringify(record.regions)} low_light=${String(record.low_light)}` };
  }
}
