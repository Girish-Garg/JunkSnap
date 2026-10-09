import { resolve } from "node:path";
import { z } from "zod";
import { parseEnv, type Env } from "./utils.js";

// From backend/server this is the repo's data/; the image sets ASSETS_DIR=/app/assets.
const DEFAULT_ASSETS_DIR = "../../data";

const AssetEnv = z.object({
  ASSETS_DIR: z.string().min(1).default(DEFAULT_ASSETS_DIR),
});

export class AssetSettings {
  readonly assetsDir: string;

  private constructor(assetsDir: string) {
    this.assetsDir = assetsDir;
  }

  static fromEnv(env: Env, cwd: string = process.cwd()): AssetSettings {
    const values = parseEnv(AssetEnv, env);
    return new AssetSettings(resolve(cwd, values.ASSETS_DIR));
  }
}
