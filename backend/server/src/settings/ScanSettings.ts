import { z } from "zod";
import { parseEnv, type Env } from "./utils.js";

const DEFAULT_PRESIGN_TTL_SECONDS = 300;

const ScanEnv = z.object({
  ORIGINALS_BUCKET: z.string().min(1),
  REPORTS_QUEUE_URL: z.url(),
  SCANS_TABLE: z.string().min(1),
  REPORTS_TABLE: z.string().min(1),
  PRESIGN_TTL_SECONDS: z.coerce.number().int().min(1).max(3_600).default(DEFAULT_PRESIGN_TTL_SECONDS),
});

type ScanEnvValues = z.output<typeof ScanEnv>;

export class ScanSettings {
  readonly originalsBucket: string;
  readonly reportsQueueUrl: string;
  readonly scansTable: string;
  readonly reportsTable: string;
  readonly presignTtlSeconds: number;

  private constructor(values: ScanEnvValues) {
    this.originalsBucket = values.ORIGINALS_BUCKET;
    this.reportsQueueUrl = values.REPORTS_QUEUE_URL;
    this.scansTable = values.SCANS_TABLE;
    this.reportsTable = values.REPORTS_TABLE;
    this.presignTtlSeconds = values.PRESIGN_TTL_SECONDS;
  }

  static fromEnv(env: Env): ScanSettings {
    return new ScanSettings(parseEnv(ScanEnv, env));
  }
}
