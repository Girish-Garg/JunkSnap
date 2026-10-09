import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { validateBrandLabel } from "../../src/contracts/index.gen.js";
import { BlurredImage } from "../../src/domain/brands/BlurredImage.js";
import { LogSink } from "../LogSink.js";
import { awsLabeller } from "./awsLabeller.js";
import { BytesImageSource } from "./BytesImageSource.js";

const FIXTURE = fileURLToPath(new URL("../fixtures/brands/brands.json", import.meta.url));
const FONTS = "Nirmala UI, Noto Sans Devanagari, Arial, sans-serif";

// A flat packet-like card with one line of text, rendered locally, so no photo is needed.
async function card(text: string): Promise<Uint8Array> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="300">
    <rect width="100%" height="100%" fill="#f4e04d"/>
    <text x="60" y="190" font-family="${FONTS}" font-size="120" font-weight="bold" fill="#b00">${text}</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg().toBuffer();
}

describe.runIf(process.env.RUN_AWS_TESTS === "1")("brand step on AWS (Rekognition, Bedrock)", () => {
  // Which Bedrock model answers depends on the account, so the Devanagari card may get Bikaji or nothing, never another brand.
  it("labels Latin text from the OCR and sends unreadable Devanagari to the Bedrock judge", async () => {
    const images = new BytesImageSource(new Map([
      ["rpt_aws_latin", await card("KURKURE Masala")],
      ["rpt_aws_hindi", await card("बीकाजी भुजिया")],
    ]));
    const sink = new LogSink();
    const labeller = awsLabeller(images, FIXTURE, sink);
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
