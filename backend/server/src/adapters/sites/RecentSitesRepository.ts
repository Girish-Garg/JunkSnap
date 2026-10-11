import type { Site } from "../../domain/sites/Site.js";
import type { GeoCells } from "../../ports/sites/GeoCells.js";
import type { SiteRepository } from "../../ports/sites/SiteRepository.js";

// The by-geohash index is eventually consistent, so a site founded a moment ago can be missing from inCell and the next
// report at that spot would found a second one. This repository remembers each site it creates until the index returns
// it, and adds it to inCell by a consistent read. In-process: with more than one worker replica, a site another replica
// founded stays invisible until the index has it (contracts/README.md). Every report near a cell queries it, so the
// memory only holds sites the index has not caught up on yet.
export class RecentSitesRepository implements SiteRepository {
  readonly #inner: SiteRepository;
  readonly #cells: GeoCells;
  // geohash4 cell -> ids of sites created here that the index has not returned yet.
  readonly #recent = new Map<string, ReadonlySet<string>>();

  constructor(inner: SiteRepository, cells: GeoCells) {
    this.#inner = inner;
    this.#cells = cells;
  }

  get(siteId: string): Promise<Site | null> {
    return this.#inner.get(siteId);
  }

  allIds(): Promise<string[]> {
    return this.#inner.allIds();
  }

  save(site: Site): Promise<void> {
    return this.#inner.save(site);
  }

  async create(site: Site): Promise<boolean> {
    const created = await this.#inner.create(site);
    if (created) {
      const cell = this.#cells.cellOf(site.point);
      this.#recent.set(cell, new Set([...(this.#recent.get(cell) ?? []), site.siteId]));
    }
    return created;
  }

  async inCell(cell: string): Promise<Site[]> {
    const indexed = await this.#inner.inCell(cell);
    const shown = new Set(indexed.map((site) => site.siteId));
    const waiting = [...(this.#recent.get(cell) ?? [])].filter((siteId) => !shown.has(siteId));
    const read = (await Promise.all(waiting.map((siteId) => this.#inner.get(siteId)))).flatMap((site) => site ?? []);
    const found = new Set(read.map((site) => site.siteId));
    this.#forget(cell, (siteId) => shown.has(siteId) || (waiting.includes(siteId) && !found.has(siteId)));
    return [...indexed, ...read];
  }

  // Drops the sites the index now returns, and any that is gone; a site created meanwhile stays.
  #forget(cell: string, done: (siteId: string) => boolean): void {
    const left = [...(this.#recent.get(cell) ?? [])].filter((siteId) => !done(siteId));
    if (left.length === 0) {
      this.#recent.delete(cell);
    } else {
      this.#recent.set(cell, new Set(left));
    }
  }
}
