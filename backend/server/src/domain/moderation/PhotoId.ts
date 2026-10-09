import { InternalDataError } from "../errors.js";

const KINDS = {
  report: { prefix: "rpt", folder: "reports" },
  cleanup: { prefix: "cln", folder: "cleanups" },
} as const;

export type PhotoKind = keyof typeof KINDS;

const SUFFIX = /^[a-z0-9_]{1,40}$/;
const UPLOAD_PREFIX = "upl_";

// rpt_x or cln_x; it shares its suffix with the upload upl_x (contracts/README.md).
export class PhotoId {
  readonly kind: PhotoKind;
  readonly #suffix: string;

  private constructor(kind: PhotoKind, suffix: string) {
    if (!SUFFIX.test(suffix)) {
      throw new InternalDataError(`bad photo id suffix: ${suffix}`);
    }
    this.kind = kind;
    this.#suffix = suffix;
  }

  static fromUpload(kind: PhotoKind, uploadId: string): PhotoId {
    if (!uploadId.startsWith(UPLOAD_PREFIX)) {
      throw new InternalDataError(`bad upload id: ${uploadId}`);
    }
    return new PhotoId(kind, uploadId.slice(UPLOAD_PREFIX.length));
  }

  get value(): string {
    return `${KINDS[this.kind].prefix}_${this.#suffix}`;
  }

  privateOriginalKey(): string {
    return `${KINDS[this.kind].folder}/${UPLOAD_PREFIX}${this.#suffix}.jpg`;
  }

  publicBlurredKey(): string {
    return `media/${KINDS[this.kind].folder}/${this.value}.jpg`;
  }
}
