import { resolve } from "node:path";
import { z } from "zod";
import { parseEnv, type Env } from "./utils.js";

const ModerationEnv = z.object({
  AWS_REGION: z.string().min(1).default("ap-south-1"),
  ORIGINALS_BUCKET: z.string().min(1),
  PUBLIC_BUCKET: z.string().min(1),
  REPORTS_TABLE: z.string().min(1),
  SITES_TABLE: z.string().min(1),
  ASSETS_DIR: z.string().min(1).optional(),
});

export class ModerationSettings {
  readonly awsRegion: string;
  readonly originalsBucket: string;
  readonly publicBucket: string;
  readonly reportsTable: string;
  readonly sitesTable: string;
  readonly assetsDir: string;

  private constructor(values: z.output<typeof ModerationEnv>, assetsDir: string) {
    this.awsRegion = values.AWS_REGION;
    this.originalsBucket = values.ORIGINALS_BUCKET;
    this.publicBucket = values.PUBLIC_BUCKET;
    this.reportsTable = values.REPORTS_TABLE;
    this.sitesTable = values.SITES_TABLE;
    this.assetsDir = assetsDir;
  }

  // ASSETS_DIR defaults to the repo's data/ folder when run from backend/server.
  static fromEnv(env: Env, cwd: string = process.cwd()): ModerationSettings {
    const values = parseEnv(ModerationEnv, env);
    return new ModerationSettings(values, resolve(cwd, values.ASSETS_DIR ?? "../../data"));
  }

  indiaOutlinePath(): string {
    return resolve(this.assetsDir, "boundaries", "india_outline.geojson");
  }
}
