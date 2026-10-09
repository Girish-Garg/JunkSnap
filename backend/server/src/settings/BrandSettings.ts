import { join } from "node:path";
import { z } from "zod";
import { parseEnv, type Env } from "./utils.js";

const BrandEnv = z.object({
  PUBLIC_BUCKET: z.string().min(1),
  // Folder laid out like the repo's data/ folder.
  ASSETS_DIR: z.string().min(1),
});

export class BrandSettings {
  readonly publicBucket: string;
  readonly brandMapPath: string;

  private constructor(publicBucket: string, assetsDir: string) {
    this.publicBucket = publicBucket;
    this.brandMapPath = join(assetsDir, "brands", "brands.json");
  }

  static fromEnv(env: Env): BrandSettings {
    const values = parseEnv(BrandEnv, env);
    return new BrandSettings(values.PUBLIC_BUCKET, values.ASSETS_DIR);
  }
}
