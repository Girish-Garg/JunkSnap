import { AreaKey, type AreaRef } from "../domain/AreaKey.js";
import type { AreaSite } from "../domain/AreaSite.js";

export interface AreaGroup {
  readonly area: AreaRef;
  readonly sites: readonly AreaSite[];
}

// One group per ward, assembly seat, Lok Sabha seat and district that holds a site; the first site names it.
export class AreaGrouper {
  group(sites: readonly AreaSite[]): AreaGroup[] {
    const groups = new Map<string, { area: AreaRef; sites: AreaSite[] }>();
    for (const site of sites) {
      for (const area of site.areas) {
        const key = AreaKey.of(area).toString();
        const group = groups.get(key) ?? { area, sites: [] };
        group.sites.push(site);
        groups.set(key, group);
      }
    }
    return [...groups.values()];
  }
}
