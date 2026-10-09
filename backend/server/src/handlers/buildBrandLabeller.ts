import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { AbstainingBrandJudge } from "../adapters/brands/AbstainingBrandJudge.js";
import { FileBrandMap } from "../adapters/brands/FileBrandMap.js";
import { PublicBucketImageSource } from "../adapters/brands/PublicBucketImageSource.js";
import { RekognitionTextPresence } from "../adapters/brands/RekognitionTextPresence.js";
import { RekognitionTextReader } from "../adapters/brands/RekognitionTextReader.js";
import type { BrandJudge } from "../ports/brands/BrandJudge.js";
import type { Logger } from "../ports/Logger.js";
import { BrandJudgeStep } from "../services/brands/BrandJudgeStep.js";
import { BrandLabeller } from "../services/brands/BrandLabeller.js";
import { BrandSettings } from "../settings/BrandSettings.js";
import type { CoreSettings } from "../settings/CoreSettings.js";
import type { Env } from "../settings/utils.js";

export interface BrandStepContext {
  readonly core: CoreSettings;
  readonly env: Env;
  readonly logger: Logger;
  readonly judge?: BrandJudge;
}

// The worker's brands step, built once per process; pass the LLM judge once the LLM layer lands.
export function buildBrandLabeller({ core, env, logger, judge }: BrandStepContext): BrandLabeller {
  const settings = BrandSettings.fromEnv(env);
  const client = new RekognitionClient({ region: core.awsRegion });
  const images = new PublicBucketImageSource(settings.publicBucket);
  if (judge === undefined) {
    logger.warn("brand judge not wired: near-threshold and unread-text cases are dropped");
  }
  return new BrandLabeller({
    reader: new RekognitionTextReader(client, images),
    map: new FileBrandMap(settings.brandMapPath),
    judgeStep: new BrandJudgeStep(judge ?? new AbstainingBrandJudge(), new RekognitionTextPresence(client, images)),
  });
}
