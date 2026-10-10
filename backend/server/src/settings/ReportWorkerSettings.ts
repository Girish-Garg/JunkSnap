import { z } from "zod";
import { parseEnv, type Env } from "./utils.js";

const ReportWorkerEnv = z.object({
  REPORTS_TABLE: z.string().min(1),
  DEVICES_TABLE: z.string().min(1),
  USERS_TABLE: z.string().min(1),
  REPORTS_QUEUE_URL: z.url(),
  ML_URL: z.url(),
});

export class ReportWorkerSettings {
  // contracts/README.md: the reports queue moves a message to the DLQ after 3 receives.
  static readonly MAX_RECEIVE_COUNT = 3;

  readonly reportsTable: string;
  readonly devicesTable: string;
  readonly usersTable: string;
  readonly reportsQueueUrl: string;
  readonly mlUrl: string;

  private constructor(values: z.output<typeof ReportWorkerEnv>) {
    this.reportsTable = values.REPORTS_TABLE;
    this.devicesTable = values.DEVICES_TABLE;
    this.usersTable = values.USERS_TABLE;
    this.reportsQueueUrl = values.REPORTS_QUEUE_URL;
    this.mlUrl = values.ML_URL;
  }

  static fromEnv(env: Env): ReportWorkerSettings {
    return new ReportWorkerSettings(parseEnv(ReportWorkerEnv, env));
  }
}
