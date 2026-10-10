import { ValidationError } from "./errors.js";
import { UploadId } from "./UploadId.js";

const PATTERN = /^rpt_[a-z0-9_]{1,40}$/;
const PREFIX = "rpt_";

export class ReportId {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static isValid(value: unknown): value is string {
    return typeof value === "string" && PATTERN.test(value);
  }

  static parse(value: unknown): ReportId {
    if (!ReportId.isValid(value)) {
      throw new ValidationError(`report_id must match ${PATTERN.source}`);
    }
    return new ReportId(value);
  }

  static fromUpload(uploadId: string): ReportId {
    return new ReportId(`${PREFIX}${UploadId.parse(uploadId).suffix}`);
  }

  originalKey(): string {
    return UploadId.fromSuffix(this.value.slice(PREFIX.length)).originalKey("report");
  }

  blurredKey(): string {
    return `media/reports/${this.value}.jpg`;
  }
}
