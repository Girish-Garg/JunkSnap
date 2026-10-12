import { vi } from 'vitest';
import { ServiceContainer } from '../src/app/ServiceContainer';
import { ApiError } from '../src/domain/ApiError';
import { CrawlProgress, type AreaCrawl } from '../src/domain/AreaCrawl';
import type { AreaListing } from '../src/domain/AreaListing';
import type { AreaKind, AreaScores } from '../src/domain/AreaScores';
import { BBox } from '../src/domain/BBox';
import type { LonLat, SiteFeature } from '../src/domain/Site';
import type { AreaApi } from '../src/services/AreaApi';
import { DESKTOP_QUERY } from '../src/ui/useMediaQuery';
import { areaRow } from './areaRows';
import { DEFAULTS } from './config';
import { MemoryStore, testServices } from './helpers';
import { ListApi } from './listApi';
import { testSite } from './siteBuilder';

type Rows = Readonly<Record<string, readonly AreaScores[]>>;

/** A scores row of any kind with `open` sites on the map. */
export function countRow(kind: AreaKind, id: string, name: string, open: number): AreaScores {
  const row = areaRow({ id, name });
  return { ...row, area: { kind, id, name }, counts: { ...row.counts, sites: open, open_sites: open } };
}

const SOORSAGAR = { id: 's20-ac-129', name: 'Soorsagar' };
const CITY_SEAT = { id: 's20-ac-128', name: 'Jodhpur' };
const JAIPUR = { district: { id: 'rajasthan-jaipur', name: 'Jaipur' }, town: 'Jaipur', assembly_seat: { id: 's20-ac-54', name: 'Malviya Nagar' } };

// Two sites in Soorsagar, west of the phone's opening view, one in the city's own seat, and one in Jaipur.
export const WEST_A: LonLat = [72.976, 26.258];
export const WEST_B: LonLat = [72.984, 26.266];
export const CENTRAL: LonLat = [73.02, 26.27];
export const JAIPUR_SITE: LonLat = [75.8156, 26.853];
export const SITES: readonly SiteFeature[] = [
  testSite({ site_id: 'site_west_a', coordinates: WEST_A, location: { assembly_seat: SOORSAGAR } }),
  testSite({ site_id: 'site_west_b', coordinates: WEST_B, location: { assembly_seat: SOORSAGAR } }),
  testSite({ site_id: 'site_central', coordinates: CENTRAL, location: { assembly_seat: CITY_SEAT } }),
  testSite({ site_id: 'site_jaipur', coordinates: JAIPUR_SITE, location: JAIPUR }),
];

/** The area list route's rows as the live api gave them on 12 Oct 2026, plus one district beside the pilot. */
export const ROWS: Rows = {
  'district/rajasthan-jodhpur': [countRow('district', 'rajasthan-jodhpur', 'Jodhpur', 45)],
  'assembly/rajasthan-jodhpur': [
    countRow('assembly', 's20-ac-128', 'Jodhpur', 9),
    countRow('assembly', 's20-ac-129', 'Soorsagar', 36),
    countRow('assembly', 's20-ac-130', 'Luni', 0),
  ],
  'district/rajasthan-jaipur': [countRow('district', 'rajasthan-jaipur', 'Jaipur', 1)],
};

/** GET /areas/{kind}?within from fixed rows; `down` answers every list with an error. */
export class RowsApi implements AreaApi {
  readonly #rows: Rows;
  readonly #down: boolean;

  constructor(rows: Rows = ROWS, down = false) {
    this.#rows = rows;
    this.#down = down;
  }

  async list(kind: AreaKind, within: string, limit: number): Promise<AreaListing> {
    if (this.#down) throw new ApiError(503, 'unavailable', 'The area list is down');
    const areas = this.#rows[`${kind}/${within}`] ?? [];
    return { kind, within, total: areas.length, limit, areas };
  }

  async scores(kind: AreaKind, id: string): Promise<AreaScores> {
    throw new ApiError(404, 'area_not_found', `${kind} ${id}`);
  }

  async crawl(districtId: string): Promise<AreaCrawl> {
    return CrawlProgress.notStarted(districtId);
  }
}

// GET /sites over SITES that remembers once the query over the whole pilot city has been answered.
class CityWatchApi extends ListApi {
  cityAnswered = false;

  override async listSites(bbox: BBox): Promise<readonly SiteFeature[]> {
    const sites = await super.listSites(bbox);
    if (bbox.toQuery() === DEFAULTS.pilot.bounds.toQuery()) this.cityAnswered = true;
    return sites;
  }
}

export interface Rig {
  readonly services: ServiceContainer;
  /** True once GET /sites over the pilot city has been answered, so a jump there fits its real sites. */
  readonly cityLoaded: () => boolean;
}

/** Services over SITES and the given area lists. */
export function placesRig(areas: AreaApi = new RowsApi(), store = new MemoryStore()): Rig {
  const api = new CityWatchApi(SITES);
  return { services: new ServiceContainer({ ...testServices(store), api, areas }), cityLoaded: () => api.cityAnswered };
}

/** Views: the whole pilot city, a phone's opening view on its middle, Jaipur, and a place with nothing near. */
export const CITY_VIEW = new BBox(72.95, 26.2, 73.1, 26.4);
export const OPENING = BBox.around(DEFAULTS.pilot.centre, 0.06);
export const JAIPUR_VIEW = BBox.around(JAIPUR_SITE, 0.06);
export const ELSEWHERE = new BBox(80, 20, 80.05, 20.05);

/** Every point lies in the pilot city, and there is at least one. */
export function inCity(points: readonly LonLat[] | undefined): boolean {
  return points !== undefined && points.length > 0 && points.every((point) => DEFAULTS.pilot.contains(point));
}

export function desktopMedia(): void {
  const media = (query: string) => ({ matches: query === DESKTOP_QUERY, addEventListener: () => undefined, removeEventListener: () => undefined });
  vi.stubGlobal('matchMedia', media);
}
