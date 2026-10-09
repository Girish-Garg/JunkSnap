import { z } from "zod";
import { ConfigError } from "../domain/errors.js";
import { parseEnv, splitList, type Env } from "./utils.js";

const ANY_ORIGIN = "*";
const STAGES = ["dev", "demo"] as const;

export type Stage = (typeof STAGES)[number];

const CoreEnv = z.object({
  JUNKSNAP_STAGE: z.enum(STAGES),
  AWS_REGION: z.string().min(1).default("ap-south-1"),
  CORS_ORIGINS: z.string().default(""),
});

// Only what every workload needs; each task reads its own variables in its own settings module.
export class CoreSettings {
  readonly stage: Stage;
  readonly awsRegion: string;
  readonly corsOrigins: readonly string[];

  private constructor(stage: Stage, awsRegion: string, corsOrigins: readonly string[]) {
    this.stage = stage;
    this.awsRegion = awsRegion;
    this.corsOrigins = corsOrigins;
  }

  static fromEnv(env: Env): CoreSettings {
    const values = parseEnv(CoreEnv, env);
    return new CoreSettings(values.JUNKSNAP_STAGE, values.AWS_REGION, splitList(values.CORS_ORIGINS));
  }

  // Only the api calls this, so worker and scores start without CORS_ORIGINS.
  allowedOrigins(): typeof ANY_ORIGIN | string[] {
    const listed = this.corsOrigins.length > 0 && !this.corsOrigins.includes(ANY_ORIGIN);
    if (listed) {
      return [...this.corsOrigins];
    }
    if (this.stage === "dev") {
      return ANY_ORIGIN;
    }
    throw new ConfigError(`CORS_ORIGINS must list exact origins in the ${this.stage} stage; * is dev only`);
  }
}
