import { z } from "zod";
import { parseEnv, type Env } from "./utils.js";

const CrawledWardEnv = z.object({
  ORIGINALS_BUCKET: z.string().optional(),
});

// Where the crawler writes crawl/wards/<city>.json; empty or absent means only the image's ward files are read.
export class CrawledWardSettings {
  readonly originalsBucket: string | null;

  private constructor(values: z.output<typeof CrawledWardEnv>) {
    const bucket = values.ORIGINALS_BUCKET?.trim() ?? "";
    this.originalsBucket = bucket === "" ? null : bucket;
  }

  static fromEnv(env: Env): CrawledWardSettings {
    return new CrawledWardSettings(parseEnv(CrawledWardEnv, env));
  }
}
