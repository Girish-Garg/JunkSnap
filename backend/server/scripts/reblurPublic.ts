// One-off for issue 110: re-blurs every public photo copy of one stage under the current blur rules.
// Usage (from backend/server, AWS_PROFILE set):
//   npx tsx scripts/reblurPublic.ts <dev|demo> --originals-bucket <name> --public-bucket <name> [--dry-run] [--force] [--key <media key>]
// --dry-run reads S3 only: no Rekognition call, no write. Copies already stamped with the current blur policy are
// skipped unless --force, so a rerun after a failure picks up where it stopped. CloudFront keeps old copies for up
// to a day: invalidate /media/* afterwards.
import { parseArgs } from "node:util";
import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { S3Client } from "@aws-sdk/client-s3";
import { RekognitionFaceFinder } from "../src/adapters/moderation/RekognitionFaceFinder.js";
import { RekognitionPlateFinder } from "../src/adapters/moderation/RekognitionPlateFinder.js";
import { RekognitionSubjectFinder } from "../src/adapters/moderation/RekognitionSubjectFinder.js";
import { type ImageBuckets, S3ImageStore } from "../src/adapters/moderation/S3ImageStore.js";
import { SharpBlurrer } from "../src/adapters/moderation/SharpBlurrer.js";
import { SharpImageCodec } from "../src/adapters/moderation/SharpImageCodec.js";
import { PhotoLoader } from "../src/services/moderation/PhotoLoader.js";
import { PrivacyBlur } from "../src/services/moderation/PrivacyBlur.js";
import { PublicReblur, type ReblurOptions } from "./reblur/PublicReblur.js";
import { S3Objects } from "./reblur/S3Objects.js";

const REGION = "ap-south-1";
const STAGES = new Set(["dev", "demo"]);
const PREFIXES = ["media/reports/", "media/cleanups/"];

interface Run {
  readonly buckets: ImageBuckets;
  readonly options: ReblurOptions;
  readonly key: string | undefined;
}

function parse(argv: readonly string[]): Run {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      "originals-bucket": { type: "string" },
      "public-bucket": { type: "string" },
      "dry-run": { type: "boolean", default: false },
      force: { type: "boolean", default: false },
      key: { type: "string" },
    },
  });
  const stage = positionals[0] ?? "";
  const originals = values["originals-bucket"] ?? "";
  const publicBucket = values["public-bucket"] ?? "";
  // The bucket names must belong to the stage named, so a copied command cannot touch another stage.
  if (!STAGES.has(stage) || !originals.startsWith(`junksnap-${stage}-originals-`) || !publicBucket.startsWith(`junksnap-${stage}-public-`)) {
    throw new Error("usage: reblurPublic.ts <dev|demo> --originals-bucket junksnap-<stage>-originals-<id> --public-bucket junksnap-<stage>-public-<id> [--dry-run] [--force] [--key <media key>]");
  }
  return { buckets: { originals, public: publicBucket }, options: { dryRun: values["dry-run"], force: values.force }, key: values.key };
}

function reblurFor(run: Run, s3: S3Client): PublicReblur {
  const rekognition = new RekognitionClient({ region: REGION });
  const store = new S3ImageStore(s3, run.buckets);
  const blur = new PrivacyBlur({
    faces: new RekognitionFaceFinder(rekognition),
    plates: new RekognitionPlateFinder(rekognition),
    subjects: new RekognitionSubjectFinder(rekognition),
    blurrer: new SharpBlurrer(),
    store,
  });
  return new PublicReblur({ objects: new S3Objects(s3), loader: new PhotoLoader(store, new SharpImageCodec()), blur, buckets: run.buckets }, run.options);
}

async function* keysOf(run: Run, objects: S3Objects): AsyncGenerator<string> {
  if (run.key !== undefined) {
    yield run.key;
    return;
  }
  for (const prefix of PREFIXES) {
    yield* objects.keys(run.buckets.public, prefix);
  }
}

async function main(run: Run): Promise<void> {
  const s3 = new S3Client({ region: REGION });
  const reblur = reblurFor(run, s3);
  const tally = new Map<string, number>();
  for await (const key of keysOf(run, new S3Objects(s3))) {
    const outcome = await reblur.one(key);
    tally.set(outcome.action, (tally.get(outcome.action) ?? 0) + 1);
    process.stdout.write(`${outcome.action}\t${outcome.key}\t${outcome.detail}\n`);
  }
  process.stdout.write(`done${run.options.dryRun ? " (dry run)" : ""}: ${JSON.stringify(Object.fromEntries(tally))}\n`);
}

await main(parse(process.argv.slice(2)));
