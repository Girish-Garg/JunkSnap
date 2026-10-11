import { BBox } from './BBox';
import { NearestSites } from './NearestSites';
import type { LonLat, SiteFeature } from './Site';
import { SiteTiles } from './SiteTiles';

/** Up to this many sites, the map and the list say plainly that sites are still few here. */
export const THIN_MAX = 2;
// How much wider than the points the landing view can be: FitPadding leaves at least a quarter of the map free.
const LANDING_ROOM = 4;

export interface ThinInput {
  /** The map's view; its sites finished loading (not pending, failed, only its middle, or mid-move). */
  readonly view: BBox | null;
  readonly settled: boolean;
  /** The view's own sites on the map, before filters. */
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
  /** Points that keep the view and take in the nearest known sites outside it; empty when none fit one load. */
  readonly zoomOut: readonly LonLat[];
}

export interface ListNoteInput {
  readonly rows: number;
  /** The rows are the pilot city's, not the view's, so a note about "here" would disagree with the map. */
  readonly fallback: boolean;
  /** A filter is on, so a low count would not be the whole truth. */
  readonly filtered: boolean;
}

/** A thin view: a settled view with at most THIN_MAX sites, and where more lie when the app already knows. */
export class ThinView {
  /** The view's answer is in: loaded, not moving, and for an empty view, the search around it is done. */
  static ready({ view, settled, sites, known }: ThinInput): boolean {
    return view !== null && settled && (sites.length > 0 || known !== null);
  }

  /** The thin state of a ready view, or null when it holds more than THIN_MAX sites (or is not ready). */
  static of(input: ThinInput): ThinState | null {
    const { view, sites, known } = input;
    if (!view || !ThinView.ready(input) || sites.length > THIN_MAX) return null;
    return { count: sites.length, zoomOut: ThinView.#zoomOut(view, known ?? []) };
  }

  /** Same count and same Zoom out: the card on screen stays as it is. */
  static same(a: ThinState | null, b: ThinState | null): boolean {
    if (!a || !b) return a === b;
    return a.count === b.count && a.zoomOut.flat().join() === b.zoomOut.flat().join();
  }

  /** The list's note: one or two rows of the view's own, with every site counted (no filter). */
  static listShows({ rows, fallback, filtered }: ListNoteInput): boolean {
    return rows <= THIN_MAX && !fallback && !filtered;
  }

  // The view's corners stay in the frame, so the move only ever widens the map; never wider than one load.
  static #zoomOut(view: BBox, known: readonly SiteFeature[]): readonly LonLat[] {
    const outside = known.filter((site) => !view.contains(site.geometry.coordinates));
    const nearest = NearestSites.of(outside, view.center());
    if (nearest.length === 0) return [];
    const points: readonly LonLat[] = [[view.minLon, view.minLat], [view.maxLon, view.maxLat], ...nearest.map((site) => site.geometry.coordinates)];
    return ThinView.#landsWhole(view, points) ? points : [];
  }

  // The view the map lands on keeps its shape and leaves room round the points; it must load whole (SiteTiles).
  static #landsWhole(view: BBox, points: readonly LonLat[]): boolean {
    const lons = points.map(([lon]) => lon);
    const lats = points.map(([, lat]) => lat);
    const box = new BBox(Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats));
    const aspect = (view.maxLat - view.minLat) / (view.maxLon - view.minLon) || 1;
    const lon = Math.max(box.maxLon - box.minLon, (box.maxLat - box.minLat) / aspect) * LANDING_ROOM;
    const [x, y] = box.center();
    return !SiteTiles.plan(new BBox(x - lon / 2, y - (lon * aspect) / 2, x + lon / 2, y + (lon * aspect) / 2)).partial;
  }
}
