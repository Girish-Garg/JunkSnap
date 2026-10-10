import { ApiError } from '../domain/ApiError';
import { CrawlProgress, type AreaCrawl } from '../domain/AreaCrawl';
import { AreaKey } from '../domain/AreaKey';
import type { AreaListing } from '../domain/AreaListing';
import { AreaRanking } from '../domain/AreaRanking';
import type { AreaKind, AreaScores } from '../domain/AreaScores';
import type { SiteFeature } from '../domain/Site';
import type { AreaApi } from './AreaApi';
import type { AreaFixtureLoaders } from './areaFixtures';
import type { CrawlFixtureLoaders } from './crawlFixtures';
import type { SiteFixtureLoaders } from './siteFixtures';
import { ZeroAreaScores } from './ZeroAreaScores';

const MAX_LIMIT = 200;

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
    const [rows, sites] = await Promise.all([this.#loadScores(), this.#loadSites()]);
    const row = MockAreaApi.#row(new AreaKey(kind, id, ''), rows, sites);
    if (row) return row;
    throw new ApiError(404, 'area_not_found', `No sites in ${kind} ${id}`);
  }

  /** Areas of this kind holding a site whose district or local body is `within`. */
  async list(kind: AreaKind, within: string, limit: number): Promise<AreaListing> {
    const [rows, sites] = await Promise.all([this.#loadScores(), this.#loadSites()]);
    const inside = sites.filter(({ properties: { location } }) =>
      [location.district.id, location.local_body?.id].includes(within),
    );
    const areas = AreaKey.fromSites(inside)
      .filter((area) => area.kind === kind)
      .flatMap((area) => MockAreaApi.#row(area, rows, sites) ?? [])
      .sort(AreaRanking.compare);
    const capped = Math.min(Math.max(limit, 1), MAX_LIMIT);
    return { kind, within, total: areas.length, limit: capped, areas: areas.slice(0, capped) };
  }

  async #loadScores(): Promise<AreaScores[]> {
    const groups = await Promise.all(Object.values(this.#scores).map((load) => load()));
    return groups.flat();
  }

  #loadSites(): Promise<SiteFeature[]> {
    return Promise.all(Object.values(this.#sites).map((load) => load()));
  }

  static #row(key: AreaKey, rows: readonly AreaScores[], sites: readonly SiteFeature[]): AreaScores | null {
    const row = rows.find(({ area }) => area.kind === key.kind && area.id === key.id);
    return row ?? MockAreaApi.#seeded(key, sites);
  }

  static #seeded(key: AreaKey, sites: readonly SiteFeature[]): AreaScores | null {
    for (const site of sites) {
      const area = AreaKey.fromLocation(site.properties.location).find((candidate) => candidate.key === key.key);
      if (area) return ZeroAreaScores.for(area, site);
    }
    return null;
  }
}
