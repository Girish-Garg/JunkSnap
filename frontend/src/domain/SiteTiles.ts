import { BBox } from './BBox';
import type { SiteFeature } from './Site';
import { SiteListing } from './SiteListing';

/** GET /sites answers at most this many sites per query, newest first (contracts/README.md; the notice text says 500). */
export const SITES_PER_QUERY = 500;

/**
 * How a view is cut into queries (the config's map settings): tiles of at most tileSpanDeg (0.99: GET /sites allows
 * 1 by 1 degree, and toQuery rounds to 5 decimals), at most tilesPerSide per side (4 by 4, about 4 degrees: a phone at
 * MapLibre zoom 7, a desktop at zoom 8).
 */
export interface Tiling {
  readonly tileSpanDeg: number;
  readonly tilesPerSide: number;
}

/** What one load of the map's sites holds. */
export interface SiteBatch {
  readonly sites: readonly SiteFeature[];
  /** A query hit the 500 cap, so older sites in its tile are missing. */
  readonly truncated: boolean;
}

/**
 * How the map loads the sites of a view: one GET /sites per tile of at most 1 degree (Tiling). A view wider than
 * 4 by 4 tiles loads only its middle 4 by 4 and says so (`partial`), so nothing is cut off silently.
 */
export class SiteTiles {
  readonly view: BBox;
  /** The part of the view that is loaded: the whole view, or its middle when `partial`. */
  readonly loaded: BBox;
  readonly tiles: readonly BBox[];
  readonly partial: boolean;

  private constructor(view: BBox, { tileSpanDeg, tilesPerSide }: Tiling) {
    const maxSpan = tileSpanDeg * tilesPerSide;
    this.view = view;
    this.partial = view.isWiderThan(maxSpan);
    this.loaded = this.partial ? view.clampedTo(maxSpan) : view;
    this.tiles = this.loaded.split(tileSpanDeg);
  }

  static plan(view: BBox, tiling: Tiling): SiteTiles {
    return new SiteTiles(view, tiling);
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
