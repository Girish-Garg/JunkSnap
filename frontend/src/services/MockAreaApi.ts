import { ApiError } from '../domain/ApiError';
import { CrawlProgress, type AreaCrawl } from '../domain/AreaCrawl';
import { AreaKey } from '../domain/AreaKey';
import type { AreaKind, AreaScores } from '../domain/AreaScores';
import type { SiteFeature } from '../domain/Site';
import type { AreaApi } from './AreaApi';
import type { AreaFixtureLoaders } from './areaFixtures';
import type { CrawlFixtureLoaders } from './crawlFixtures';
import type { SiteFixtureLoaders } from './siteFixtures';
import { ZeroAreaScores } from './ZeroAreaScores';

/**
 * Mirrors the api: a fixture row, else the worker's zero row for an area with sites, else area_not_found.
 * A district's crawl is its fixture, else not_started, as for a district with no crawls row.
 */
export class MockAreaApi implements AreaApi {
  readonly #scores: AreaFixtureLoaders;
  readonly #sites: SiteFixtureLoaders;
  readonly #crawls: CrawlFixtureLoaders;

  constructor(scores: AreaFixtureLoaders, sites: SiteFixtureLoaders, crawls: CrawlFixtureLoaders) {
    this.#scores = scores;
    this.#sites = sites;
    this.#crawls = crawls;
  }

  async crawl(districtId: string): Promise<AreaCrawl> {
    const rows = await Promise.all(Object.values(this.#crawls).map((load) => load()));
    return rows.find((row) => row.district_id === districtId) ?? CrawlProgress.notStarted(districtId);
  }

  async scores(kind: AreaKind, id: string): Promise<AreaScores> {
    const rows = await Promise.all(Object.values(this.#scores).map((load) => load()));
    const row = rows.find((candidate) => candidate.area.kind === kind && candidate.area.id === id);
    if (row) return row;
    const sites = await Promise.all(Object.values(this.#sites).map((load) => load()));
    const seeded = MockAreaApi.#seeded(kind, id, sites);
    if (seeded) return seeded;
    throw new ApiError(404, 'area_not_found', `No sites in ${kind} ${id}`);
  }

  static #seeded(kind: AreaKind, id: string, sites: readonly SiteFeature[]): AreaScores | null {
    for (const site of sites) {
      const area = AreaKey.fromLocation(site.properties.location).find((key) => key.kind === kind && key.id === id);
      if (area) return ZeroAreaScores.for(area, site);
    }
    return null;
  }
}
