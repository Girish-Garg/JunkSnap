// One-off for issue 110: re-blurs every public photo copy of one stage under the current blur rules.
// Usage (from backend/server, AWS_PROFILE set):
//   npx tsx scripts/reblurPublic.ts <dev|demo> --originals-bucket <name> --public-bucket <name> [--dry-run] [--force] [--key <media key>]
// --dry-run reads S3 only: no Rekognition call, no write. Copies already stamped with the current blur policy are
// skipped unless --force, so a rerun after a failure picks up where it stopped. CloudFront keeps old copies for up
// to a day: invalidate /media/* afterwards.
import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { S3Client } from "@aws-sdk/client-s3";
import { RekognitionFaceFinder } from "../src/adapters/moderation/RekognitionFaceFinder.js";
import { RekognitionPlateFinder } from "../src/adapters/moderation/RekognitionPlateFinder.js";
import { RekognitionSubjectFinder } from "../src/adapters/moderation/RekognitionSubjectFinder.js";
import { S3ImageStore } from "../src/adapters/moderation/S3ImageStore.js";
import { SharpBlurrer } from "../src/adapters/moderation/SharpBlurrer.js";
import { SharpImageCodec } from "../src/adapters/moderation/SharpImageCodec.js";
import { PhotoLoader } from "../src/services/moderation/PhotoLoader.js";
import { PrivacyBlur } from "../src/services/moderation/PrivacyBlur.js";
import { CacheSettings } from "../src/settings/CacheSettings.js";
import { PublicReblur } from "./reblur/PublicReblur.js";
import { parseReblurArgs, type ReblurRun } from "./reblur/ReblurArgs.js";
import { S3Objects } from "./reblur/S3Objects.js";

const REGION = "ap-south-1";
const PREFIXES = ["media/reports/", "media/cleanups/"];

function reblurFor(run: ReblurRun, s3: S3Client): PublicReblur {
  const rekognition = new RekognitionClient({ region: REGION });
  const store = new S3ImageStore(s3, run.buckets, CacheSettings.fromEnv(process.env).mediaMaxAgeSeconds);
  const blur = new PrivacyBlur({
    faces: new RekognitionFaceFinder(rekognition),
    plates: new RekognitionPlateFinder(rekognition),
    subjects: new RekognitionSubjectFinder(rekognition),
    blurrer: new SharpBlurrer(),
    store,
  });
  return new PublicReblur({ objects: new S3Objects(s3), loader: new PhotoLoader(store, new SharpImageCodec()), blur, buckets: run.buckets }, run.options);
}

async function* keysOf(run: ReblurRun, objects: S3Objects): AsyncGenerator<string> {
  if (run.key !== undefined) {
    yield run.key;
    return;
  }
  for (const prefix of PREFIXES) {
    yield* objects.keys(run.buckets.public, prefix);
  }
}

async function main(run: ReblurRun): Promise<void> {
  const s3 = new S3Client({ region: REGION });
  const reblur = reblurFor(run, s3);
  const tally = new Map<string, number>();
  for await (const key of keysOf(run, new S3Objects(s3))) {
    const outcome = await reblur.attempt(key);
    tally.set(outcome.action, (tally.get(outcome.action) ?? 0) + 1);
    process.stdout.write(`${outcome.action}\t${outcome.key}\t${outcome.detail}\n`);
  }
  process.stdout.write(`done${run.options.dryRun ? " (dry run)" : ""}: ${JSON.stringify(Object.fromEntries(tally))}\n`);
  process.stdout.write("CloudFront and browsers keep old copies for up to a day: invalidate /media/* on the stage's distribution.\n");
  if ((tally.get("failed") ?? 0) > 0) {
    process.exitCode = 1;
  }
}

await main(parseReblurArgs(process.argv.slice(2)));
