import type { BoundingBox } from "../../domain/sites/BoundingBox.js";
import type { Site } from "../../domain/sites/Site.js";
import { SiteNotFoundError } from "../../domain/sites/SiteErrors.js";
import type { SiteFeature } from "../../domain/sites/SiteTypes.js";
import type { Clock } from "../../ports/sites/Clock.js";
import type { GeoCells } from "../../ports/sites/GeoCells.js";
import type { SiteRepository } from "../../ports/sites/SiteRepository.js";

export class SiteFinder {
  readonly #sites: SiteRepository;
  readonly #cells: GeoCells;
  readonly #clock: Clock;
  readonly #maxSites: number;

  // maxSites: MAP_MAX_SITES.
  constructor(sites: SiteRepository, cells: GeoCells, clock: Clock, maxSites: number) {
    this.#sites = sites;
    this.#cells = cells;
    this.#clock = clock;
    this.#maxSites = maxSites;
  }

  // Newest first, at most maxSites; rejected, removed, cleaned and expired sites left out (contracts/README.md).
  async inBox(box: BoundingBox): Promise<SiteFeature[]> {
    const cells = this.#cells.covering(box);
    const perCell = await Promise.all(cells.map((cell) => this.#sites.inCell(cell)));
    return perCell
      .flat()
      .map((site) => this.#current(site))
      .filter((site) => site.isListed() && box.contains(site.point))
      .sort(SiteFinder.#newestFirst)
      .slice(0, this.#maxSites)
      .map((site) => site.toFeature());
  }

  async byId(siteId: string): Promise<SiteFeature> {
    const site = await this.#sites.get(siteId);
    if (site === null) {
      throw new SiteNotFoundError(`No site ${siteId}`);
    }
    return this.#current(site).toFeature();
  }

  // Decision 20261010-1855: a lapsed site reads as expired before the scores CronJob marks the row.
  #current(site: Site): Site {
    site.expireIfLapsed(this.#clock.now());
    return site;
  }

  static #newestFirst(a: Site, b: Site): number {
    const byTime = Date.parse(b.lastReportedAt) - Date.parse(a.lastReportedAt);
    return byTime !== 0 ? byTime : a.siteId.localeCompare(b.siteId);
  }
}
