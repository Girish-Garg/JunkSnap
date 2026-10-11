import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { S3Client } from "@aws-sdk/client-s3";
import { FileBrandMap } from "../adapters/brands/FileBrandMap.js";
import { JUDGE_ANSWER_SCHEMA } from "../adapters/brands/JudgeAnswerSchema.js";
import { PublicBucketImageSource } from "../adapters/brands/PublicBucketImageSource.js";
import { RekognitionTextPresence } from "../adapters/brands/RekognitionTextPresence.js";
import { RekognitionTextReader } from "../adapters/brands/RekognitionTextReader.js";
import { S3BlurredImageStore } from "../adapters/brands/S3BlurredImageStore.js";
import type { Logger } from "../ports/Logger.js";
import { BrandJudgeStep } from "../services/brands/BrandJudgeStep.js";
import { BrandLabeller } from "../services/brands/BrandLabeller.js";
import { LlmBrandJudge } from "../services/brands/LlmBrandJudge.js";
import { BrandSettings } from "../settings/BrandSettings.js";
import type { CoreSettings } from "../settings/CoreSettings.js";
import type { Env } from "../settings/utils.js";
import { buildProviderRouter } from "./LlmModule.js";
import { TimeoutSettings } from "../settings/TimeoutSettings.js";
import { awsClientConfig } from "./utils.js";

export interface BrandStepContext {
  readonly core: CoreSettings;
  readonly env: Env;
  readonly logger: Logger;
}

// The worker's brands step, built once per process; the judge uses LLM task "brands" (Bedrock only in the worker).
export function buildBrandLabeller({ core, env, logger }: BrandStepContext): BrandLabeller {
  const settings = BrandSettings.fromEnv(env);
  const aws = TimeoutSettings.fromEnv(env).aws;
  const rekognition = new RekognitionClient(awsClientConfig(core.awsRegion, aws.wait));
  const images = new PublicBucketImageSource(settings.publicBucket);
  const judge = new LlmBrandJudge({
    router: buildProviderRouter(env, core, logger),
    images: new S3BlurredImageStore(new S3Client(awsClientConfig(core.awsRegion, aws.transfer)), settings.publicBucket),
    schema: JUDGE_ANSWER_SCHEMA,
  });
  return new BrandLabeller({
    reader: new RekognitionTextReader(rekognition, images),
    map: new FileBrandMap(settings.brandMapPath),
    judgeStep: new BrandJudgeStep(judge, new RekognitionTextPresence(rekognition, images), logger),
  });
}
