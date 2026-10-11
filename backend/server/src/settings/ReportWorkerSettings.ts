import { z } from "zod";
import { parseEnv, type Env } from "./utils.js";

const ReportWorkerEnv = z.object({
  REPORTS_TABLE: z.string().min(1),
  DEVICES_TABLE: z.string().min(1),
  USERS_TABLE: z.string().min(1),
  REPORTS_QUEUE_URL: z.url(),
  ML_URL: z.url(),
  CONFIRM_TTL_HOURS: z.coerce.number().positive().default(24),
});

export class ReportWorkerSettings {
  readonly reportsTable: string;
  readonly devicesTable: string;
  readonly usersTable: string;
  readonly reportsQueueUrl: string;
  readonly mlUrl: string;
  // Hours a reporter has to answer a needs_confirmation report (contracts v1.16).
  readonly confirmTtlHours: number;

  private constructor(values: z.output<typeof ReportWorkerEnv>) {
    this.reportsTable = values.REPORTS_TABLE;
    this.devicesTable = values.DEVICES_TABLE;
    this.usersTable = values.USERS_TABLE;
    this.reportsQueueUrl = values.REPORTS_QUEUE_URL;
    this.mlUrl = values.ML_URL;
    this.confirmTtlHours = values.CONFIRM_TTL_HOURS;
  }

  static fromEnv(env: Env): ReportWorkerSettings {
    return new ReportWorkerSettings(parseEnv(ReportWorkerEnv, env));
  }
}
