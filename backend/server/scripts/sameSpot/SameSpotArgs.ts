import { parseArgs } from "node:util";
import type { Stage } from "../../src/settings/CoreSettings.js";
import type { Env } from "../../src/settings/utils.js";

const STAGES: readonly Stage[] = ["dev", "demo"];
const USAGE = "usage: mergeSameSpotSites.ts <dev|demo> [--apply]";
export const APPLY_NEEDS_BASE_URL =
  "--apply needs PUBLIC_BASE_URL, the stage's https base URL that the worker builds photo URLs from";

// The stage's own tables, so a copied command cannot touch another stage.
export interface SameSpotTables {
  readonly sites: string;
  readonly reports: string;
  readonly votes: string;
  readonly notes: string;
}

export interface SameSpotRun {
  readonly stage: Stage;
  readonly tables: SameSpotTables;
  // Null for the dry run, which writes nothing.
  readonly apply: { readonly publicBaseUrl: string } | null;
}

// The stage is always named; --apply also needs PUBLIC_BASE_URL.
export class SameSpotArgs {
  readonly #env: Env;

  constructor(env: Env) {
    this.#env = env;
  }

  parse(argv: readonly string[]): SameSpotRun {
    const options = { apply: { type: "boolean", default: false } } as const;
    const { values, positionals } = parseArgs({ args: [...argv], allowPositionals: true, options });
    const stage = STAGES.find((name) => name === positionals[0]);
    if (stage === undefined || positionals.length !== 1) {
      throw new Error(USAGE);
    }
    const table = (name: string) => `junksnap-${stage}-${name}`;
    const tables = { sites: table("sites"), reports: table("reports"), votes: table("votes"), notes: table("notes") };
    return { stage, tables, apply: values.apply ? { publicBaseUrl: this.#baseUrl() } : null };
  }

  #baseUrl(): string {
    const value = this.#env.PUBLIC_BASE_URL;
    if (value === undefined || !URL.canParse(value) || new URL(value).protocol !== "https:") {
      throw new Error(APPLY_NEEDS_BASE_URL);
    }
    return value.replace(/\/+$/, "");
  }
}
