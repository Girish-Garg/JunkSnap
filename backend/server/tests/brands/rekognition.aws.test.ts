import { fileURLToPath } from "node:url";
import { RekognitionClient } from "@aws-sdk/client-rekognition";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { validateBrandLabel } from "../../src/contracts/index.gen.js";
import { AbstainingBrandJudge } from "../../src/adapters/brands/AbstainingBrandJudge.js";
import { BytesImageSource } from "../../src/adapters/brands/BytesImageSource.js";
import { FileBrandMap } from "../../src/adapters/brands/FileBrandMap.js";
import { RekognitionTextPresence } from "../../src/adapters/brands/RekognitionTextPresence.js";
import { RekognitionTextReader } from "../../src/adapters/brands/RekognitionTextReader.js";
import { BlurredImage } from "../../src/domain/brands/BlurredImage.js";
import { BrandJudgeStep } from "../../src/services/brands/BrandJudgeStep.js";
import { BrandLabeller } from "../../src/services/brands/BrandLabeller.js";

const FIXTURE = fileURLToPath(new URL("../fixtures/brands/brands.json", import.meta.url));
const FONTS = "Nirmala UI, Noto Sans Devanagari, Arial, sans-serif";

// A flat packet-like card with one line of text, rendered locally, so no photo is needed.
async function card(text: string): Promise<Uint8Array> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="300">
    <rect width="100%" height="100%" fill="#f4e04d"/>
    <text x="60" y="190" font-family="${FONTS}" font-size="120" font-weight="bold" fill="#b00">${text}</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg().toBuffer();
}

describe.runIf(process.env.RUN_AWS_TESTS === "1")("Rekognition brand adapters (AWS)", () => {
  it("labels printed Latin text and sees Devanagari as text it cannot read", async () => {
    const images = new BytesImageSource(new Map([
      ["rpt_aws_latin", await card("KURKURE Masala")],
      ["rpt_aws_hindi", await card("बीकाजी भुजिया")],
    ]));
    const client = new RekognitionClient({ region: process.env.AWS_REGION ?? "ap-south-1" });
    const presence = new RekognitionTextPresence(client, images);
    const labeller = new BrandLabeller({
      reader: new RekognitionTextReader(client, images),
      map: new FileBrandMap(FIXTURE),
      judgeStep: new BrandJudgeStep(new AbstainingBrandJudge(), presence),
    });
    const labels = await labeller.label(new BlurredImage("rpt_aws_latin"));
    expect(labels.map((label) => [label.brand, label.text_seen])).toEqual([["Kurkure", "KURKURE"]]);
    expect(validateBrandLabel(labels[0])).toBeDefined();
    const hindi = new BlurredImage("rpt_aws_hindi");
    expect((await new RekognitionTextReader(client, images).read(hindi)).lines).toEqual([]);
    expect(await presence.hasText(hindi)).toBe(true);
  }, 30_000);
});
