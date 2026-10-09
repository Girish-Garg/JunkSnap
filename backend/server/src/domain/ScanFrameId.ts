import { createHash } from "node:crypto";

const SUFFIX_LENGTH = 26;

// Ids come from the scan id and frame time, so a retried scan makes the same reports.
export class ScanFrameId {
  readonly uploadId: string;
  readonly reportId: string;

  private constructor(suffix: string) {
    this.uploadId = `upl_${suffix}`;
    this.reportId = `rpt_${suffix}`;
  }

  static of(scanId: string, tMs: number): ScanFrameId {
    const digest = createHash("sha256").update(`${scanId}:${tMs}`).digest("hex");
    return new ScanFrameId(digest.slice(0, SUFFIX_LENGTH));
  }

  get originalKey(): string {
    return `reports/${this.uploadId}.jpg`;
  }
}
