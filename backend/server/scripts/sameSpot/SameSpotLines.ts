import type { Site } from "../../src/domain/sites/Site.js";
import { propertiesOf } from "./SameSpotGrouper.js";
import type { SameSpotFindings } from "./SameSpotScan.js";

// The dry run's output: one line per site with its id, report count, backers and verification; absorbed sites add
// their distance from the site they would merge into.
export class SameSpotLines {
  readonly #stage: string;
  readonly #sameSpotM: number;

  constructor(stage: string, sameSpotM: number) {
    this.#stage = stage;
    this.#sameSpotM = sameSpotM;
  }

  lines(findings: SameSpotFindings): string[] {
    const head = `${this.#stage}: ${findings.read} sites read, ${findings.open} open photo sites, SITE_SAME_SPOT_M ${this.#sameSpotM} m`;
    const body = findings.groups.flatMap((group, index) => [
      `group ${index + 1} ${propertiesOf(group.keep).report_type}: keep ${SameSpotLines.#site(group.keep)}`,
      ...group.absorb.map(({ site, distanceM }) => `  absorb ${SameSpotLines.#site(site)} at ${distanceM} m`),
    ]);
    const absorbed = findings.groups.reduce((total, group) => total + group.absorb.length, 0);
    const tail = `found: ${findings.groups.length} groups, ${absorbed} sites to merge into the oldest site of their group`;
    return [head, ...body, tail];
  }

  static #site(site: Site): string {
    const { site_id, report_count, backers, verification, first_reported_at } = propertiesOf(site);
    const reports = report_count === 1 ? "1 report" : `${report_count} reports`;
    return `${site_id} (${reports}, ${backers.count} of ${backers.needed} backers, ${verification}, first ${first_reported_at})`;
  }
}
