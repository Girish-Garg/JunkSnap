// Real moderation run on local JPEGs: Rekognition only, blurred copies to a folder, no S3 or DynamoDB.
// Usage: npx tsx scripts/moderatePhotos.ts <photo folder> <output folder>, with AWS_PROFILE set.
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { RekognitionClient } from "@aws-sdk/client-rekognition";
import sharp from "sharp";
import { PassThroughNoteModerator } from "../src/adapters/moderation/PassThroughNoteModerator.js";
import { RekognitionFaceFinder } from "../src/adapters/moderation/RekognitionFaceFinder.js";
import { RekognitionImageModerator } from "../src/adapters/moderation/RekognitionImageModerator.js";
import { RekognitionPlateFinder } from "../src/adapters/moderation/RekognitionPlateFinder.js";
import { SharpBlurrer } from "../src/adapters/moderation/SharpBlurrer.js";
import { SharpImageCodec } from "../src/adapters/moderation/SharpImageCodec.js";
import { SystemClock } from "../src/adapters/moderation/SystemClock.js";
import { TurfGeofence } from "../src/adapters/moderation/TurfGeofence.js";
import { type ModerationResult, validateModerationResult } from "../src/contracts/index.gen.js";
import { GeoPoint } from "../src/domain/moderation/GeoPoint.js";
import { PerceptualHash } from "../src/domain/moderation/PerceptualHash.js";
import { PhotoSubmission } from "../src/domain/moderation/PhotoSubmission.js";
import { INDIA_BUFFER_DEG } from "../src/handlers/moderation/ModerationServiceFactory.js";
import { AuthenticityService } from "../src/services/moderation/AuthenticityService.js";
import { CheckFactory } from "../src/services/moderation/CheckFactory.js";
import { ModerationService } from "../src/services/moderation/ModerationService.js";
import { PhotoLoader } from "../src/services/moderation/PhotoLoader.js";
import { PrivacyBlur } from "../src/services/moderation/PrivacyBlur.js";
import { ModerationSettings } from "../src/settings/ModerationSettings.js";
import { LocalImageStore } from "./moderation/LocalImageStore.js";
import { MemoryDeviceRegistry } from "./moderation/MemoryDeviceRegistry.js";
import { MemoryHashIndex } from "./moderation/MemoryHashIndex.js";

const JODHPUR = new GeoPoint(26.26183, 73.00352);
const DEVICE = "3f6c2a1e-8b4d-4c7a-9e21-5d0b7f3a6c14";

class PhotoRun {
  readonly #store: LocalImageStore;
  readonly #hashes = new MemoryHashIndex();
  readonly #devices = new MemoryDeviceRegistry();
  readonly #service: ModerationService;

  constructor(outDir: string, outlinePath: string) {
    this.#store = new LocalImageStore(outDir);
    const rekognition = new RekognitionClient({ region: process.env.AWS_REGION ?? "ap-south-1" });
    const india = TurfGeofence.fromFile(outlinePath, INDIA_BUFFER_DEG);
    this.#service = new ModerationService({
      loader: new PhotoLoader(this.#store, new SharpImageCodec()),
      gate: new RekognitionImageModerator(rekognition),
      blur: new PrivacyBlur({
        faces: new RekognitionFaceFinder(rekognition),
        plates: new RekognitionPlateFinder(rekognition),
        blurrer: new SharpBlurrer(),
        store: this.#store,
      }),
      authenticity: new AuthenticityService(new CheckFactory({ india, hashes: this.#hashes, devices: this.#devices })),
      notes: new PassThroughNoteModerator(),
      clock: new SystemClock(),
    });
  }

  async moderate(name: string, bytes: Uint8Array): Promise<ModerationResult> {
    const uploadId = `upl_${name}`;
    this.#store.put(`reports/${uploadId}.jpg`, bytes);
    this.#devices.record();
    const now = new Date();
    const submission = PhotoSubmission.fromReport(
      {
        upload_id: uploadId,
        report_type: "waste_dump",
        context: "roadside",
        capture_mode: "snap",
        sha256: createHash("sha256").update(bytes).digest("hex"),
        gps: { lat: JODHPUR.lat, lon: JODHPUR.lon, accuracy_m: 8 },
        device_token: DEVICE,
        captured_at: new Date(now.getTime() - 60_000).toISOString(),
      },
      now.toISOString(),
    );
    const result = validateModerationResult(await this.#service.moderate(submission));
    if (result.outcome === "passed") {
      this.#hashes.add(result.report_id, PerceptualHash.fromHex(result.phash), JODHPUR);
    }
    return result;
  }
}

function row(name: string, result: ModerationResult): string {
  const cells = [
    name,
    String(result.blur?.faces ?? "-"),
    String(result.blur?.plates ?? "-"),
    `${result.image_moderation.result} ${result.image_moderation.labels.join(", ")}`.trim(),
    result.outcome,
    result.reasons.join(", ") || "-",
    result.checks.duplicate.detail,
  ];
  return `| ${cells.join(" | ")} |`;
}

async function main(inDir: string, outDir: string): Promise<void> {
  await mkdir(outDir, { recursive: true });
  const run = new PhotoRun(outDir, ModerationSettings.fromEnv({ ...process.env, ORIGINALS_BUCKET: "-", PUBLIC_BUCKET: "-", REPORTS_TABLE: "-", SITES_TABLE: "-" }).indiaOutlinePath());
  const files = (await readdir(inDir)).filter((file) => /\.jpe?g$/i.test(file)).sort();
  const results: Record<string, ModerationResult> = {};
  const lines = ["| photo | faces | plates | gate | outcome | reasons | duplicate check |", "|---|---|---|---|---|---|---|"];
  for (const file of files) {
    const name = file.replace(/\.jpe?g$/i, "").toLowerCase().replace(/[^a-z0-9_]/g, "_");
    results[name] = await run.moderate(name, new Uint8Array(await readFile(join(inDir, file))));
    lines.push(row(name, results[name]));
  }
  const first = files[0];
  if (first !== undefined) {
    const copy = new Uint8Array(await sharp(await readFile(join(inDir, first))).resize(1600).jpeg({ quality: 70 }).toBuffer());
    results.resubmitted = await run.moderate("resubmitted", copy);
    lines.push(row(`resubmitted (${first} re-encoded at 1600 px)`, results.resubmitted));
  }
  await writeFile(join(outDir, "results.json"), JSON.stringify(results, null, 2));
  process.stdout.write(`${lines.join("\n")}\n`);
}

const [inDir, outDir] = process.argv.slice(2);
if (inDir === undefined || outDir === undefined) {
  throw new Error("usage: tsx scripts/moderatePhotos.ts <photo folder> <output folder>");
}
await main(inDir, outDir);
