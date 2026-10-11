import type { Site } from "../../src/domain/sites/Site.js";
import type { SiteRepository } from "../../src/ports/sites/SiteRepository.js";
import type { SameSpotGroup, SameSpotGrouper } from "./SameSpotGrouper.js";

export interface SameSpotFindings {
  readonly read: number;
  readonly open: number;
  readonly groups: readonly SameSpotGroup[];
}

// Reads every site of one stage (a full table scan, then a consistent read per site) and finds the same-spot groups.
// It only reads: the --apply step waits for a removed_reason for merged sites (see SameSpotArgs).
export class SameSpotScan {
  readonly #sites: SiteRepository;
  readonly #grouper: SameSpotGrouper;

  constructor(sites: SiteRepository, grouper: SameSpotGrouper) {
    this.#sites = sites;
    this.#grouper = grouper;
  }

  async run(): Promise<SameSpotFindings> {
    const sites: Site[] = [];
    for (const siteId of await this.#sites.allIds()) {
      const site = await this.#sites.get(siteId);
      if (site !== null) {
        sites.push(site);
      }
    }
    const open = this.#grouper.open(sites);
    return { read: sites.length, open: open.length, groups: this.#grouper.groups(open) };
  }
}
