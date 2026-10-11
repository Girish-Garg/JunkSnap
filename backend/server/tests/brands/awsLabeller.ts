import { RekognitionClient } from "@aws-sdk/client-rekognition";
import sharp from "sharp";
import { FileBrandMap } from "../../src/adapters/brands/FileBrandMap.js";
import { JUDGE_ANSWER_SCHEMA } from "../../src/adapters/brands/JudgeAnswerSchema.js";
import { RekognitionTextPresence } from "../../src/adapters/brands/RekognitionTextPresence.js";
import { RekognitionTextReader } from "../../src/adapters/brands/RekognitionTextReader.js";
import { buildProviderRouter } from "../../src/handlers/LlmModule.js";
import { BrandJudgeStep } from "../../src/services/brands/BrandJudgeStep.js";
import { BrandLabeller } from "../../src/services/brands/BrandLabeller.js";
import { LlmBrandJudge } from "../../src/services/brands/LlmBrandJudge.js";
import { CoreSettings } from "../../src/settings/CoreSettings.js";
import type { LogSink } from "../LogSink.js";
import type { BytesImageSource } from "./BytesImageSource.js";
import { brandLogger } from "./fakes.js";
import { MODELS } from "../defaults.js";

// The worker's object graph with local bytes in place of the public bucket: Rekognition, then the Bedrock judge.
export function awsLabeller(images: BytesImageSource, brandMapPath: string, sink: LogSink): BrandLabeller {
  const env = { JUNKSNAP_STAGE: "dev", AWS_REGION: process.env.AWS_REGION ?? "ap-south-1" };
  const core = CoreSettings.fromEnv(env);
  const logger = brandLogger(sink);
  const rekognition = new RekognitionClient({ region: core.awsRegion });
  const judge = new LlmBrandJudge({ router: buildProviderRouter(env, core, logger), images, schema: JUDGE_ANSWER_SCHEMA, maxTokens: MODELS.brandJudgeMaxTokens });
  return new BrandLabeller({
    reader: new RekognitionTextReader(rekognition, images),
    map: new FileBrandMap(brandMapPath),
    judgeStep: new BrandJudgeStep(judge, new RekognitionTextPresence(rekognition, images), logger),
  });
}

// Rekognition takes at most 5 MB of bytes; phone uploads are about this size anyway.
export async function shrinkForRekognition(bytes: Uint8Array): Promise<Uint8Array> {
  const resized = sharp(Buffer.from(bytes)).rotate().resize(1920, 1920, { fit: "inside", withoutEnlargement: true });
  return resized.jpeg({ quality: 90 }).toBuffer();
}
