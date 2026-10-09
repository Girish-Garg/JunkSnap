import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateBrandLabel, type BrandLabel } from "../../src/contracts/index.gen.js";
import { BlurredImage } from "../../src/domain/brands/BlurredImage.js";
import { LogSink } from "../LogSink.js";
import { awsLabeller, shrinkForRekognition } from "./awsLabeller.js";
import { BytesImageSource } from "./BytesImageSource.js";
import { CommonsPhotoCache, type PhotoSource } from "./CommonsPhotoCache.js";

interface PrecisionPhoto extends PhotoSource {
  readonly page: string;
  readonly license: string;
  readonly shows: string;
  readonly expected: readonly string[];
  readonly also_printed: readonly string[];
}

interface Row {
  readonly photo: PrecisionPhoto;
  readonly labels: readonly BrandLabel[];
  readonly correct: number;
  readonly found: boolean;
}

const MANIFEST = fileURLToPath(new URL("../fixtures/brands/precision-photos.json", import.meta.url));
const SHIPPED_MAP = fileURLToPath(new URL("../../../../data/brands/brands.json", import.meta.url));
// A wrong company name is worse than a missed one, so the bar is on precision; recall is reported only.
const PRECISION_FLOOR = 0.9;

function photos(): PrecisionPhoto[] {
  return (JSON.parse(readFileSync(MANIFEST, "utf8")) as { photos: PrecisionPhoto[] }).photos;
}

function score(photo: PrecisionPhoto, labels: readonly BrandLabel[]): Row {
  const printed = new Set([...photo.expected, ...photo.also_printed]);
  const correct = labels.filter((label) => printed.has(label.brand)).length;
  return { photo, labels, correct, found: labels.some((label) => photo.expected.includes(label.brand)) };
}

function report(rows: readonly Row[]): { precision: number; text: string } {
  const returned = rows.reduce((sum, row) => sum + row.labels.length, 0);
  const correct = rows.reduce((sum, row) => sum + row.correct, 0);
  const found = rows.filter((row) => row.found).length;
  const precision = returned === 0 ? 1 : correct / returned;
  const lines = rows.map(({ photo, labels, correct: right }) => {
    const got = labels.map((label) => `${label.brand}@${String(label.confidence)} "${label.text_seen}"`).join(", ") || "none";
    return `${photo.id}  expected ${photo.expected.join("/")}  got ${got}  correct ${String(right)}/${String(labels.length)}`;
  });
  const summary = `precision ${String(correct)}/${String(returned)} = ${precision.toFixed(3)}; recall ${String(found)}/${String(rows.length)} photos`;
  return { precision, text: [...lines, summary].join("\n") };
}

describe.runIf(process.env.RUN_AWS_TESTS === "1")("brand precision on the Commons photo set (AWS)", () => {
  it("names only brands printed in each photo and reports precision and recall", async () => {
    const cache = new CommonsPhotoCache();
    const set = photos();
    const bytes = new Map<string, Uint8Array>();
    for (const photo of set) {
      bytes.set(photo.id, await shrinkForRekognition(await cache.bytes(photo)));
    }
    const labeller = awsLabeller(new BytesImageSource(bytes), SHIPPED_MAP, new LogSink());
    const rows: Row[] = [];
    for (const photo of set) {
      const labels = await labeller.label(new BlurredImage(photo.id));
      labels.forEach((label) => validateBrandLabel(label));
      rows.push(score(photo, labels));
    }
    const { precision, text } = report(rows);
    console.log(text);
    expect(precision).toBeGreaterThanOrEqual(PRECISION_FLOOR);
  }, 900_000);
});
