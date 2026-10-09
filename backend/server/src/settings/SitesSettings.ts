import { z } from "zod";
import { parseEnv, type Env } from "./utils.js";

const SitesEnv = z.object({
  SITES_TABLE: z.string().min(1),
  VOTES_TABLE: z.string().min(1),
  CLEANUPS_TABLE: z.string().min(1),
  REPORTS_TABLE: z.string().min(1),
  DEVICES_TABLE: z.string().min(1),
  SCORES_TABLE: z.string().min(1),
  ORIGINALS_BUCKET: z.string().min(1),
  PUBLIC_BASE_URL: z.url(),
  REPORTS_QUEUE_URL: z.url(),
});

export interface SiteTables {
  readonly sites: string;
  readonly votes: string;
  readonly cleanups: string;
  readonly reports: string;
  readonly devices: string;
  readonly scores: string;
}

// Variable names from contracts/README.md; the api and the worker read the same set.
export class SitesSettings {
  readonly tables: SiteTables;
  readonly originalsBucket: string;
  readonly publicBaseUrl: string;
  readonly reportsQueueUrl: string;

  private constructor(values: z.output<typeof SitesEnv>) {
    this.tables = {
      sites: values.SITES_TABLE,
      votes: values.VOTES_TABLE,
      cleanups: values.CLEANUPS_TABLE,
      reports: values.REPORTS_TABLE,
      devices: values.DEVICES_TABLE,
      scores: values.SCORES_TABLE,
    };
    this.originalsBucket = values.ORIGINALS_BUCKET;
    this.publicBaseUrl = values.PUBLIC_BASE_URL;
    this.reportsQueueUrl = values.REPORTS_QUEUE_URL;
  }

  static fromEnv(env: Env): SitesSettings {
    return new SitesSettings(parseEnv(SitesEnv, env));
  }
}
