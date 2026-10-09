import { fileURLToPath } from "node:url";
import { RekognitionClient } from "@aws-sdk/client-rekognition";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { BytesImageSource } from "../../src/adapters/brands/BytesImageSource.js";
import { FileBrandMap } from "../../src/adapters/brands/FileBrandMap.js";
import { JUDGE_ANSWER_SCHEMA } from "../../src/adapters/brands/JudgeAnswerSchema.js";
import { RekognitionTextPresence } from "../../src/adapters/brands/RekognitionTextPresence.js";
import { RekognitionTextReader } from "../../src/adapters/brands/RekognitionTextReader.js";
import { validateBrandLabel } from "../../src/contracts/index.gen.js";
import { BlurredImage } from "../../src/domain/brands/BlurredImage.js";
import { buildProviderRouter } from "../../src/handlers/LlmModule.js";
import { BrandJudgeStep } from "../../src/services/brands/BrandJudgeStep.js";
import { BrandLabeller } from "../../src/services/brands/BrandLabeller.js";
import { LlmBrandJudge } from "../../src/services/brands/LlmBrandJudge.js";
import { CoreSettings } from "../../src/settings/CoreSettings.js";
import { LogSink } from "../LogSink.js";
import { brandLogger } from "./fakes.js";

const FIXTURE = fileURLToPath(new URL("../fixtures/brands/brands.json", import.meta.url));
const FONTS = "Nirmala UI, Noto Sans Devanagari, Arial, sans-serif";

// A flat packet-like card with one line of text, rendered locally, so no photo is needed.
async function card(text: string): Promise<Uint8Array> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="300">
    <rect width="100%" height="100%" fill="#f4e04d"/>
    <text x="60" y="190" font-family="${FONTS}" font-size="120" font-weight="bold" fill="#b00">${text}</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg().toBuffer();
}

function labellerFor(images: BytesImageSource, sink: LogSink): BrandLabeller {
  const env = { JUNKSNAP_STAGE: "dev", AWS_REGION: process.env.AWS_REGION ?? "ap-south-1" };
  const core = CoreSettings.fromEnv(env);
  const logger = brandLogger(sink);
  const rekognition = new RekognitionClient({ region: core.awsRegion });
  const judge = new LlmBrandJudge({ router: buildProviderRouter(env, core, logger), images, schema: JUDGE_ANSWER_SCHEMA });
  return new BrandLabeller({
    reader: new RekognitionTextReader(rekognition, images),
    map: new FileBrandMap(FIXTURE),
    judgeStep: new BrandJudgeStep(judge, new RekognitionTextPresence(rekognition, images), logger),
  });
}

describe.runIf(process.env.RUN_AWS_TESTS === "1")("brand step on AWS (Rekognition, Bedrock)", () => {
  // Which Bedrock model answers depends on the account, so the Devanagari card may get Bikaji or nothing, never another brand.
  it("labels Latin text from the OCR and sends unreadable Devanagari to the Bedrock judge", async () => {
    const images = new BytesImageSource(new Map([
      ["rpt_aws_latin", await card("KURKURE Masala")],
      ["rpt_aws_hindi", await card("बीकाजी भुजिया")],
    ]));
    const sink = new LogSink();
    const labeller = labellerFor(images, sink);
    const latin = await labeller.label(new BlurredImage("rpt_aws_latin"));
    expect(latin.map((label) => [label.brand, label.text_seen, label.provider])).toEqual([["Kurkure", "KURKURE", "rekognition"]]);
    const hindi = await labeller.label(new BlurredImage("rpt_aws_hindi"));
    const answered = sink.records().filter((record) => record.message === "llm_call" && record.outcome === "ok");
    expect(answered.map((record) => [record.task, record.provider])).toEqual([["brands", "bedrock"]]);
    expect(hindi.every((label) => label.brand === "Bikaji" && label.provider === "bedrock")).toBe(true);
    for (const label of [...latin, ...hindi]) {
      expect(validateBrandLabel(label)).toBe(label);
    }
  }, 90_000);
});
