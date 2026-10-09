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
    const origins = CoreSettings.#allowedOrigins(values.JUNKSNAP_STAGE, splitList(values.CORS_ORIGINS));
    return new CoreSettings(values.JUNKSNAP_STAGE, values.AWS_REGION, origins);
  }

  get allowsAnyOrigin(): boolean {
    return this.corsOrigins.includes(ANY_ORIGIN);
  }

  static #allowedOrigins(stage: Stage, origins: readonly string[]): readonly string[] {
    if (stage === "dev") {
      return origins.length === 0 ? [ANY_ORIGIN] : origins;
    }
    if (origins.length === 0 || origins.includes(ANY_ORIGIN)) {
      throw new ConfigError(`CORS_ORIGINS must list exact origins in the ${stage} stage; * is dev only`);
    }
    return origins;
  }
}
