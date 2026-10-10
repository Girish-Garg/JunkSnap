import { ValidationError } from "./errors.js";

export type UploadPurpose = "report" | "cleanup";

const PATTERN = /^upl_[a-z0-9_]{1,40}$/;
const PREFIX = "upl_";
const FOLDERS: Readonly<Record<UploadPurpose, string>> = { report: "reports", cleanup: "cleanups" };

// A report or cleanup reuses its upload's suffix (upl_x becomes rpt_x), so a retried POST is idempotent.
export class UploadId {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static parse(value: string): UploadId {
    if (!PATTERN.test(value)) {
      throw new ValidationError(`upload_id must match ${PATTERN.source}`);
    }
    return new UploadId(value);
  }

  static fromSuffix(suffix: string): UploadId {
    return UploadId.parse(`${PREFIX}${suffix}`);
  }

  get suffix(): string {
    return this.value.slice(PREFIX.length);
  }

  originalKey(purpose: UploadPurpose): string {
    return `${FOLDERS[purpose]}/${this.value}.jpg`;
  }
}
