import { join } from "node:path";
import { z } from "zod";
import { parseEnv, type Env } from "./utils.js";

const LettersEnv = z.object({
  ASSETS_DIR: z.string().min(1),
  SITES_TABLE: z.string().min(1),
  DEVICES_TABLE: z.string().min(1),
  USERS_TABLE: z.string().min(1),
});

export interface LetterTables {
  readonly sites: string;
  readonly devices: string;
  readonly users: string;
}

export class LettersSettings {
  // ASSETS_DIR is the repo's data/ folder or its copy in the image; rules live in its rules/ folder.
  readonly rulesDir: string;
  readonly tables: LetterTables;

  private constructor(rulesDir: string, tables: LetterTables) {
    this.rulesDir = rulesDir;
    this.tables = tables;
  }

  static fromEnv(env: Env): LettersSettings {
    const values = parseEnv(LettersEnv, env);
    return new LettersSettings(join(values.ASSETS_DIR, "rules"), {
      sites: values.SITES_TABLE,
      devices: values.DEVICES_TABLE,
      users: values.USERS_TABLE,
    });
  }
}
