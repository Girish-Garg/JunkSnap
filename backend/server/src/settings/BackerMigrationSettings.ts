import { z } from "zod";
import type { Stage } from "./CoreSettings.js";
import { parseEnv, type Env } from "./utils.js";

const TablesEnv = z.object({
  SITES_TABLE: z.string().min(1).optional(),
  VOTES_TABLE: z.string().min(1).optional(),
  REPORTS_TABLE: z.string().min(1).optional(),
});

// Only the three tables the backers migration touches; names default to junksnap-<stage>-<table> for a local run.
export class BackerMigrationSettings {
  readonly sitesTable: string;
  readonly votesTable: string;
  readonly reportsTable: string;

  private constructor(sitesTable: string, votesTable: string, reportsTable: string) {
    this.sitesTable = sitesTable;
    this.votesTable = votesTable;
    this.reportsTable = reportsTable;
  }

  static fromEnv(stage: Stage, env: Env): BackerMigrationSettings {
    const values = parseEnv(TablesEnv, env);
    const name = (table: string) => `junksnap-${stage}-${table}`;
    return new BackerMigrationSettings(
      values.SITES_TABLE ?? name("sites"),
      values.VOTES_TABLE ?? name("votes"),
      values.REPORTS_TABLE ?? name("reports"),
    );
  }
}
