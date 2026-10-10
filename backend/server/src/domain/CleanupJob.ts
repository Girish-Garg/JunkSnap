import type { ReportUpload } from "../contracts/index.gen.js";
import { ValidationError } from "./errors.js";
import type { QueueMessage } from "./QueueMessage.js";
import type { Reporter } from "./ReportRecord.js";
import { UploadId } from "./UploadId.js";
import type { VerifyRequest } from "./VerifyRequest.js";

const CLEANUP_ID = /^cln_[a-z0-9_]{1,40}$/;
const SITE_ID = /^site_[a-z0-9_]{1,40}$/;
const UPLOAD_ID = /^upl_[a-z0-9_]{1,40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const USER_ID = /^[A-Za-z0-9-]{1,128}$/;
const PRESENT = /./;

export type Gps = ReportUpload["gps"];

export interface CleanupData {
  readonly cleanup_id: string;
  readonly site_id: string;
  readonly upload_id: string;
  readonly device_token: string;
  readonly user_id?: string;
  readonly sha256: string;
  readonly gps: Gps;
  readonly captured_at: string;
  readonly received_at: string;
}

export interface SiteKind {
  readonly report_type: ReportUpload["report_type"];
  readonly context: ReportUpload["context"];
}

// A cleanup after-photo to check, read from its queue message.
export class CleanupJob {
  readonly data: CleanupData;

  private constructor(data: CleanupData) {
    this.data = Object.freeze(data);
  }

  static fromMessage(message: QueueMessage): CleanupJob {
    const text = (name: string, pattern: RegExp) => CleanupJob.#text(message.field(name), name, pattern);
    return new CleanupJob({
      cleanup_id: text("cleanup_id", CLEANUP_ID),
      site_id: text("site_id", SITE_ID),
      upload_id: text("upload_id", UPLOAD_ID),
      device_token: text("device_token", PRESENT),
      user_id: CleanupJob.#optionalUser(message.field("user_id")),
      sha256: text("sha256", SHA256),
      gps: CleanupJob.#gps(message.field("gps")),
      captured_at: text("captured_at", PRESENT),
      received_at: text("received_at", PRESENT),
    });
  }

  get id(): string {
    return this.data.cleanup_id;
  }

  reporter(): Reporter {
    return { deviceToken: this.data.device_token, userId: this.data.user_id };
  }

  originalKey(): string {
    return UploadId.parse(this.data.upload_id).originalKey("cleanup");
  }

  blurredKey(): string {
    return `media/cleanups/${this.data.cleanup_id}.jpg`;
  }

  // Cleanups never count nearby reports, per contracts/README.md.
  verifyRequest(site: SiteKind, reputation: number): VerifyRequest {
    const features = { gps_accuracy_m: this.data.gps.accuracy_m, reputation, nearby_verified_reports: 0 };
    return { report_id: this.id, purpose: "cleanup", blurred_key: this.blurredKey(), ...site, features };
  }

  static #text(value: unknown, name: string, pattern: RegExp): string {
    if (typeof value !== "string" || !pattern.test(value)) {
      throw new ValidationError(`cleanup message ${name} is missing or malformed`);
    }
    return value;
  }

  // Absent only on guest cleanups made before accounts.
  static #optionalUser(value: unknown): string | undefined {
    return value === undefined ? undefined : CleanupJob.#text(value, "user_id", USER_ID);
  }

  static #gps(value: unknown): Gps {
    const gps = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
    const { lat, lon, accuracy_m: accuracy } = gps;
    if (typeof lat !== "number" || typeof lon !== "number" || typeof accuracy !== "number") {
      throw new ValidationError("cleanup message gps needs numeric lat, lon and accuracy_m");
    }
    return { lat, lon, accuracy_m: accuracy };
  }
}
