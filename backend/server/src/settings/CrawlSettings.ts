import { z } from "zod";
import { parseEnv, type Env } from "./utils.js";

const CrawlEnv = z.object({
  CRAWLS_TABLE: z.string().optional(),
  CRAWL_ACTIVATE_AFTER: z.coerce.number().int().min(1).default(1),
});

// The crawls table for the api (read) and the worker (queue); empty or absent disables both, as in local dev.
export class CrawlSettings {
  readonly crawlsTable: string | null;
  readonly activateAfter: number;

  private constructor(values: z.output<typeof CrawlEnv>) {
    const table = values.CRAWLS_TABLE?.trim() ?? "";
    this.crawlsTable = table === "" ? null : table;
    this.activateAfter = values.CRAWL_ACTIVATE_AFTER;
  }

  static fromEnv(env: Env): CrawlSettings {
    return new CrawlSettings(parseEnv(CrawlEnv, env));
  }
}
