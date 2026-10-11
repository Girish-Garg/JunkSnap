import { parseArgs } from "node:util";
import type { Stage } from "../../src/settings/CoreSettings.js";

const STAGES: readonly Stage[] = ["dev", "demo"];
const USAGE = "usage: mergeSameSpotSites.ts <dev|demo> [--apply]";

// Merging would mark each absorbed site status removed, and site.removed_reason allows only withdrawn and
// photos_reported, neither of which is true of a merged duplicate. A new value is a contract change, so --apply
// stops here until the human makes it (decision 20261011-1610-hem-same-spot-merge).
export const APPLY_NEEDS_CONTRACT =
  "--apply is not available yet: an absorbed site would become status removed, and the site contract's removed_reason " +
  "allows only withdrawn and photos_reported. A value for merged sites is a contract change; until it lands, run the " +
  "dry run and merge nothing.";

export interface SameSpotRun {
  readonly stage: Stage;
  // The stage's own table, so a copied command cannot read another stage.
  readonly sitesTable: string;
}

export function parseSameSpotArgs(argv: readonly string[]): SameSpotRun {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: { apply: { type: "boolean", default: false } },
  });
  const stage = STAGES.find((name) => name === positionals[0]);
  if (stage === undefined || positionals.length !== 1) {
    throw new Error(USAGE);
  }
  if (values.apply) {
    throw new Error(APPLY_NEEDS_CONTRACT);
  }
  return { stage, sitesTable: `junksnap-${stage}-sites` };
}
