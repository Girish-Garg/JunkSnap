import { ApiError } from '../domain/ApiError';
import { AreaKey } from '../domain/AreaKey';
import type { AreaKind, AreaScores } from '../domain/AreaScores';
import type { SiteFeature } from '../domain/Site';
import type { AreaApi } from './AreaApi';
import type { AreaFixtureLoaders } from './areaFixtures';
import type { SiteFixtureLoaders } from './siteFixtures';
import { ZeroAreaScores } from './ZeroAreaScores';

/** Mirrors the api: a fixture row, else the worker's zero row for an area with sites, else area_not_found. */
export class MockAreaApi implements AreaApi {
  readonly #scores: AreaFixtureLoaders;
  readonly #sites: SiteFixtureLoaders;

  constructor(scores: AreaFixtureLoaders, sites: SiteFixtureLoaders) {
    this.#scores = scores;
    this.#sites = sites;
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
