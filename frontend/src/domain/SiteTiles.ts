import { BBox } from './BBox';
import type { SiteFeature } from './Site';
import { SiteListing } from './SiteListing';

// GET /sites allows 1 by 1 degree (contracts/README.md); stay under it after toQuery rounds to 5 decimals.
const MAX_QUERY_SPAN_DEG = 0.99;
// At most 4 by 4 queries per view, about 4 degrees: a phone at MapLibre zoom 7, a desktop at zoom 8.
const MAX_TILES_PER_SIDE = 4;
/** GET /sites answers at most this many sites per query, newest first. */
export const SITES_PER_QUERY = 500;

/** What one load of the map's sites holds. */
export interface SiteBatch {
  readonly sites: readonly SiteFeature[];
  /** A query hit the 500 cap, so older sites in its tile are missing. */
  readonly truncated: boolean;
}

/**
 * How the map loads the sites of a view: one GET /sites per tile of at most 1 degree. A view wider than
 * 4 by 4 tiles loads only its middle 4 by 4 and says so (`partial`), so nothing is cut off silently.
 */
export class SiteTiles {
  readonly view: BBox;
  /** The part of the view that is loaded: the whole view, or its middle when `partial`. */
  readonly loaded: BBox;
  readonly tiles: readonly BBox[];
  readonly partial: boolean;

  private constructor(view: BBox) {
    const maxSpan = MAX_QUERY_SPAN_DEG * MAX_TILES_PER_SIDE;
    this.view = view;
    this.partial = view.isWiderThan(maxSpan);
    this.loaded = this.partial ? view.clampedTo(maxSpan) : view;
    this.tiles = this.loaded.split(MAX_QUERY_SPAN_DEG);
  }

  static plan(view: BBox): SiteTiles {
    return new SiteTiles(view);
  }

  /** One list per tile into one: each site once, only sites the active map shows, newest first. */
  merge(results: readonly (readonly SiteFeature[])[]): SiteBatch {
    const byId = new Map<string, SiteFeature>();
    for (const site of results.flat()) {
      if (SiteListing.onMap(site.properties)) byId.set(site.properties.site_id, site);
    }
    const sites = [...byId.values()].sort((a, b) => b.properties.last_reported_at.localeCompare(a.properties.last_reported_at));
    return { sites, truncated: results.some((result) => result.length >= SITES_PER_QUERY) };
  }
}
