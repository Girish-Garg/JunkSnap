import { BBox } from '../domain/BBox';
import type { LonLat } from '../domain/Site';
import { EnvReader } from './EnvReader';
import type { EnvVars } from './EnvVar';
import { Vars } from './Vars';

/** The basemap, the opening view on the pilot city, how a view loads its sites, and the map's own timings. */
export interface MapSettings {
  /** MapLibre style for the site map and the long-range target map; OpenFreeMap needs no key. */
  readonly styleUrl: string;
  /** Folder under the app's base URL that holds the boundary files (public/boundaries/). */
  readonly boundariesPath: string;
  /** The pilot city's middle: where the map always opens. */
  readonly pilotCentre: LonLat;
  /** The pilot city's extent (the ward map's, rounded outwards); one GET /sites over it loads the whole city. */
  readonly pilotBounds: BBox;
  /** MapLibre zoom the map opens at; 12 shows about 6 km across a phone. */
  readonly pilotZoom: number;
  /** Zoom a single site or search result is shown at, at least. */
  readonly siteZoom: number;
  readonly minZoom: number;
  /** The map cannot be panned outside this box (India). */
  readonly maxBounds: BBox;
  /** OpenFreeMap tiles stop at 14 and are overzoomed; past 18 a phone shows a few metres of plain background. */
  readonly maxZoom: number;
  /** Zoom the long-range target map opens at: about 400 m across a phone-width map. */
  readonly targetZoom: number;
  /** Up to this many sites, the map and the list say plainly that sites are still few here. */
  readonly thinMax: number;
  /** Side of one GET /sites query in degrees; the api allows 1, and the query rounds to 5 decimals. */
  readonly tileSpanDeg: number;
  /** At most this many queries per side of a view; a wider view loads only its middle. */
  readonly tilesPerSide: number;
  /** Plain padding round the points of a fit (Zoom out, a stack of sites). */
  readonly fitPaddingPx: number;
  /** Padding when a card leaves too little room for the plain padding. */
  readonly fitTightPx: number;
  /** Below this share of the map's height left free, a fit with a card up would squeeze the points into a sliver. */
  readonly fitMinFree: number;
  /** How long a one-line message over the map stays, for example after a report is withdrawn. */
  readonly flashMs: number;
  /** A basemap still loading after this says it is loading (nothing shows before, so a quick load never flickers). */
  readonly loadingAfterMs: number;
  /** A basemap still loading after this says the network is slow. */
  readonly slowAfterMs: number;
  /** Sites closer than this many metres share one pin (a stack) at every zoom. */
  readonly pinStackRadiusM: number;
  /** Sites whose pins or n/10 badges would come closer than this on screen share a pin at that zoom. */
  readonly pinStackOverlapPx: number;
}

const zoom = (name: string, fallback: number) => Vars.number(name, fallback, { min: 0, max: 22 });

export const MAP_VARS: EnvVars<MapSettings> = {
  styleUrl: Vars.url('VITE_MAP_STYLE_URL', 'https://tiles.openfreemap.org/styles/positron'),
  boundariesPath: Vars.folder('VITE_BOUNDARIES_PATH', 'boundaries/'),
  pilotCentre: Vars.lonLat('VITE_PILOT_CENTRE', [73.02, 26.27]),
  pilotBounds: Vars.box('VITE_PILOT_BOUNDS', new BBox(72.96, 26.22, 73.08, 26.36)),
  pilotZoom: zoom('VITE_PILOT_ZOOM', 12),
  siteZoom: zoom('VITE_MAP_SITE_ZOOM', 14),
  minZoom: zoom('VITE_MAP_MIN_ZOOM', 4),
  maxBounds: Vars.box('VITE_MAP_MAX_BOUNDS', new BBox(60, 4, 100, 38.5)),
  maxZoom: zoom('VITE_MAP_MAX_ZOOM', 18),
  targetZoom: zoom('VITE_TARGET_MAP_ZOOM', 16),
  thinMax: Vars.count('VITE_THIN_MAX', 2, 100, 0),
  tileSpanDeg: Vars.number('VITE_SITE_TILE_DEG', 0.99, { min: 0.01, max: 0.99 }),
  tilesPerSide: Vars.count('VITE_SITE_TILES_PER_SIDE', 4, 10),
  fitPaddingPx: Vars.count('VITE_MAP_FIT_PADDING_PX', 80, 500, 0),
  fitTightPx: Vars.count('VITE_MAP_FIT_TIGHT_PX', 16, 500, 0),
  fitMinFree: Vars.fraction('VITE_MAP_FIT_MIN_FREE', 0.25),
  flashMs: Vars.ms('VITE_MAP_FLASH_MS', 4000, 60_000),
  loadingAfterMs: Vars.ms('VITE_MAP_LOADING_AFTER_MS', 600, 60_000),
  slowAfterMs: Vars.ms('VITE_MAP_SLOW_AFTER_MS', 8000, 300_000),
  pinStackRadiusM: Vars.number('VITE_PIN_STACK_RADIUS_M', 20, { min: 0, max: 1000 }),
  pinStackOverlapPx: Vars.count('VITE_PIN_STACK_OVERLAP_PX', 40, 500, 0),
};

export const MAP_DEFAULTS: MapSettings = EnvReader.defaults(MAP_VARS);
