import { z } from "zod";
import { parseEnv, type Env } from "./utils.js";

const IntakeEnv = z.object({
  REPORTS_TABLE: z.string().min(1),
  ORIGINALS_BUCKET: z.string().min(1),
  REPORTS_QUEUE_URL: z.url(),
  PUBLIC_BASE_URL: z.url(),
  PRESIGN_TTL_SECONDS: z.coerce.number().int().positive().default(300),
});

export class IntakeSettings {
  readonly reportsTable: string;
  readonly originalsBucket: string;
  readonly reportsQueueUrl: string;
  readonly publicBaseUrl: string;
  readonly presignTtlSeconds: number;

  private constructor(values: z.output<typeof IntakeEnv>) {
    this.reportsTable = values.REPORTS_TABLE;
    this.originalsBucket = values.ORIGINALS_BUCKET;
    this.reportsQueueUrl = values.REPORTS_QUEUE_URL;
    this.publicBaseUrl = values.PUBLIC_BASE_URL.replace(/\/+$/, "");
    this.presignTtlSeconds = values.PRESIGN_TTL_SECONDS;
  }

  static fromEnv(env: Env): IntakeSettings {
    return new IntakeSettings(parseEnv(IntakeEnv, env));
  }
}
