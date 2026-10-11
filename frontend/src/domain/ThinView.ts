import type { BBox } from './BBox';
import { NearestSites } from './NearestSites';
import type { LonLat, SiteFeature } from './Site';

/** Up to this many sites, the map and the list say plainly that reports are still few here. */
export const THIN_MAX = 2;

export interface ThinInput {
  /** The map's view; its sites finished loading (not pending, failed or only its middle). */
  readonly view: BBox | null;
  readonly settled: boolean;
  /** The view's own sites, before filters. */
  readonly sites: readonly SiteFeature[];
  /**
   * Sites the app already holds beyond the view (the search around an empty view, the pilot city), or null while
   * the search around an empty view is still on its way. Never a request of its own.
   */
  readonly known: readonly SiteFeature[] | null;
}

export interface ThinState {
  /** Sites in view, 0 to THIN_MAX. */
  readonly count: number;
  /** Points that keep the view and take in the nearest known sites outside it; empty when none are known. */
  readonly zoomOut: readonly LonLat[];
}

export interface ListNoteInput {
  readonly rows: number;
  /** The rows are the pilot city's and it has not loaded (or failed): the list shows that state instead. */
  readonly waiting: boolean;
  /** A filter is on, so a low count would not be the whole truth. */
  readonly filtered: boolean;
}

/** A thin view: a settled view with at most THIN_MAX sites, and where more lie when the app already knows. */
export class ThinView {
  static of({ view, settled, sites, known }: ThinInput): ThinState | null {
    if (!view || !settled || sites.length > THIN_MAX) return null;
    // Like the toast, an empty view never says so before the search around it is done.
    if (sites.length === 0 && known === null) return null;
    return { count: sites.length, zoomOut: ThinView.#zoomOut(view, known ?? []) };
  }

  /** The list's note: at most THIN_MAX rows, with every site counted (no filter), once they are in. */
  static listShows({ rows, waiting, filtered }: ListNoteInput): boolean {
    return rows <= THIN_MAX && !waiting && !filtered;
  }

  // The view's corners stay in the frame, so the move only ever widens the map.
  static #zoomOut(view: BBox, known: readonly SiteFeature[]): readonly LonLat[] {
    const outside = known.filter((site) => !view.contains(site.geometry.coordinates));
    const nearest = NearestSites.of(outside, view.center());
    if (nearest.length === 0) return [];
    return [[view.minLon, view.minLat], [view.maxLon, view.maxLat], ...nearest.map((site) => site.geometry.coordinates)];
  }
}
