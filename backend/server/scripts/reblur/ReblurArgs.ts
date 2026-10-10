import { parseArgs } from "node:util";
import type { ImageBuckets } from "../../src/adapters/moderation/S3ImageStore.js";
import type { ReblurOptions } from "./PublicReblur.js";

const STAGES = new Set(["dev", "demo"]);
const USAGE =
  "usage: reblurPublic.ts <dev|demo> --originals-bucket junksnap-<stage>-originals-<id> --public-bucket junksnap-<stage>-public-<id> [--dry-run] [--force] [--key <media key>]";

export interface ReblurRun {
  readonly buckets: ImageBuckets;
  readonly options: ReblurOptions;
  // One public key only, or undefined for every copy under media/.
  readonly key: string | undefined;
}

// Both bucket names must belong to the stage named, so a copied command cannot touch another stage.
export function parseReblurArgs(argv: readonly string[]): ReblurRun {
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
  if (!STAGES.has(stage) || !originals.startsWith(`junksnap-${stage}-originals-`) || !publicBucket.startsWith(`junksnap-${stage}-public-`)) {
    throw new Error(USAGE);
  }
  return { buckets: { originals, public: publicBucket }, options: { dryRun: values["dry-run"], force: values.force }, key: values.key };
}
