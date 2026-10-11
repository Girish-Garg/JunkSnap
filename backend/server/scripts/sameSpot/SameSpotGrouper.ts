import { olderFirst } from "../../src/domain/sites/MergeCandidates.js";
import type { Site } from "../../src/domain/sites/Site.js";
import type { SiteProperties } from "../../src/domain/sites/SiteTypes.js";

export interface Absorbed {
  readonly site: Site;
  // From the kept site's point, rounded to 0.1 m.
  readonly distanceM: number;
}

export interface SameSpotGroup {
  readonly keep: Site;
  readonly absorb: readonly Absorbed[];
}

interface Keeper {
  readonly site: Site;
  readonly absorb: Absorbed[];
}

export const propertiesOf = (site: Site): SiteProperties => site.snapshot().feature.properties;

// Decision 20261011-1610-hem-same-spot-merge, for duplicates the old rule left: oldest first, each open photo site joins
// the nearest older kept site of its type within sameSpotM (the older on a tie), else it is kept. So every absorbed
// site is within sameSpotM of the site it would merge into, and no chain of neighbours stretches a group further.
export class SameSpotGrouper {
  readonly #sameSpotM: number;
  readonly #now: Date;

  constructor(sameSpotM: number, now: Date) {
    this.#sameSpotM = sameSpotM;
    this.#now = now;
  }

  // On the active map and not a no-bin zone: rejected, removed, cleaned and expired sites stay as they are, and zones
  // keep their own ZONE_MERGE_RADIUS_M rule. Expiry is applied on read, as GET /sites does; nothing is saved.
  open(sites: readonly Site[]): Site[] {
    return sites.filter((site) => {
      site.expireIfLapsed(this.#now);
      return site.isListed() && propertiesOf(site).report_type !== "no_bin";
    });
  }

  groups(sites: readonly Site[]): SameSpotGroup[] {
    const keepers: Keeper[] = [];
    for (const site of this.open(sites).sort(olderFirst)) {
      const keeper = this.#nearestKeeper(site, keepers);
      if (keeper === undefined) {
        keepers.push({ site, absorb: [] });
      } else {
        keeper.absorb.push({ site, distanceM: Math.round(keeper.site.point.distanceTo(site.point) * 10) / 10 });
      }
    }
    return keepers.filter((keeper) => keeper.absorb.length > 0).map(({ site, absorb }) => ({ keep: site, absorb }));
  }

  // Keepers come oldest first, and the sort is stable, so the older one wins a tie.
  #nearestKeeper(site: Site, keepers: readonly Keeper[]): Keeper | undefined {
    const type = propertiesOf(site).report_type;
    const distance = (keeper: Keeper) => keeper.site.point.distanceTo(site.point);
    const near = keepers.filter((keeper) => propertiesOf(keeper.site).report_type === type && distance(keeper) <= this.#sameSpotM);
    return near.sort((a, b) => distance(a) - distance(b))[0];
  }
}
