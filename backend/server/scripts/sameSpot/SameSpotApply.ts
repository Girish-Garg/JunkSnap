import type { GroupMerger } from "./GroupMerger.js";
import type { GroupPlanner } from "./GroupPlanner.js";
import type { SameSpotGroup } from "./SameSpotGrouper.js";

export interface ApplySummary {
  readonly merged: number;
  // Left for a person: the reason is printed.
  readonly skipped: number;
  // A duplicate took a new report during the run; the next run finishes the group.
  readonly leftOpen: number;
}

// --apply: each group is checked afresh, then merged into its oldest site or skipped with the reason printed.
export class SameSpotApply {
  readonly #planner: GroupPlanner;
  readonly #merger: GroupMerger;
  readonly #print: (line: string) => void;

  constructor(planner: GroupPlanner, merger: GroupMerger, print: (line: string) => void) {
    this.#planner = planner;
    this.#merger = merger;
    this.#print = print;
  }

  async run(groups: readonly SameSpotGroup[]): Promise<ApplySummary> {
    const tally = { merged: 0, skipped: 0, leftOpen: 0 };
    for (const group of groups) {
      const planned = await this.#planner.plan(group);
      if ("skip" in planned) {
        this.#print(`skipped the group of ${group.keep.siteId}: ${planned.skip}; merge it by hand`);
        tally.skipped += 1;
        continue;
      }
      this.#print(`merging ${planned.plan.absorb.map(({ site }) => site.siteId).join(", ")} into ${group.keep.siteId}`);
      const done = await this.#merger.apply(planned.plan);
      tally[done ? "merged" : "leftOpen"] += 1;
    }
    this.#print(`applied: ${tally.merged} groups merged, ${tally.skipped} skipped, ${tally.leftOpen} left open for the next run`);
    return { ...tally };
  }
}
