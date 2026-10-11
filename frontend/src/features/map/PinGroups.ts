import { MAP_DEFAULTS, type MapSettings } from '../../config/MapSettings';
import { REPORT_TYPES, type ReportType } from '../../domain/ReportType';
import type { LonLat, SiteFeature } from '../../domain/Site';
import { SiteListing } from '../../domain/SiteListing';

// MapLibre zoom 0 is one 512 px tile for the whole world.
const WORLD_PX_AT_ZOOM_0 = 512;
const METRES_PER_DEG_LAT = 110_540;
const METRES_PER_DEG_LON_AT_EQUATOR = 111_320;

/** Sites at one pin: one site, or a stack of sites at (nearly) the same spot. */
export interface PinGroup {
  readonly sites: readonly SiteFeature[];
  /** The mean of the sites' points. */
  readonly position: LonLat;
  /** The type most of the sites have; ties go to the earlier type in legend order. */
  readonly lead: ReportType;
  /** Every site in it is still waiting for 10 people (drawn hollow). */
  readonly unverified: boolean;
}

/**
 * The config's map settings: sites closer than pinStackRadiusM (20 m) share a pin at every zoom, and sites whose pins
 * or n/10 badges would overlap on screen share a pin at that zoom. A pin disc is about 26 px and its n/10 badge about
 * 34 by 20 px, 18 px below it: pinStackOverlapPx (40 px) apart, neither touches.
 */
export type PinGroupLimits = Pick<MapSettings, 'pinStackRadiusM' | 'pinStackOverlapPx'>;

/**
 * Groups site pins that sit on one spot (a photo site and a scan site, or two report types at one place) so
 * they draw as one pin with a count. Leader grouping: the first free site in id order takes every free site
 * near it. Every site lands in exactly one group, so none is ever hidden.
 */
export class PinGroups {
  readonly #limits: PinGroupLimits;

  constructor(limits: PinGroupLimits = MAP_DEFAULTS) {
    this.#limits = limits;
  }

  /** Rejected, removed and cleared sites are off the active map (SiteListing.onMap), so no pin or stack holds them. */
  of(sites: readonly SiteFeature[], zoom: number): readonly PinGroup[] {
    let free = sites
      .filter((site) => SiteListing.onMap(site.properties))
      .sort((a, b) => a.properties.site_id.localeCompare(b.properties.site_id));
    const groups: PinGroup[] = [];
    while (free.length > 0) {
      const seed = (free[0] as SiteFeature).geometry.coordinates;
      // The seed is 0 m from itself, so it always leads its own group.
      const members = free.filter((site) => this.#near(seed, site.geometry.coordinates, zoom));
      free = free.filter((site) => !members.includes(site));
      groups.push(PinGroups.#group(members));
    }
    return groups;
  }

  #near(a: LonLat, b: LonLat, zoom: number): boolean {
    const { pinStackRadiusM, pinStackOverlapPx } = this.#limits;
    return PinGroups.metresBetween(a, b) <= pinStackRadiusM || PinGroups.pixelsBetween(a, b, zoom) <= pinStackOverlapPx;
  }

  /** Ground distance; equirectangular is exact enough over a few hundred metres. */
  static metresBetween([lonA, latA]: LonLat, [lonB, latB]: LonLat): number {
    const cosLat = Math.cos((((latA + latB) / 2) * Math.PI) / 180);
    const dx = (lonB - lonA) * METRES_PER_DEG_LON_AT_EQUATOR * cosLat;
    const dy = (latB - latA) * METRES_PER_DEG_LAT;
    return Math.hypot(dx, dy);
  }

  /** Screen distance between two points at a MapLibre zoom (Web Mercator). */
  static pixelsBetween(a: LonLat, b: LonLat, zoom: number): number {
    const world = WORLD_PX_AT_ZOOM_0 * 2 ** zoom;
    const [ax, ay] = PinGroups.#mercator(a);
    const [bx, by] = PinGroups.#mercator(b);
    return Math.hypot(bx - ax, by - ay) * world;
  }

  static #mercator([lon, lat]: LonLat): [number, number] {
    const phi = (lat * Math.PI) / 180;
    return [(lon + 180) / 360, (1 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / Math.PI) / 2];
  }

  static #group(sites: readonly SiteFeature[]): PinGroup {
    const lon = sites.reduce((sum, site) => sum + site.geometry.coordinates[0], 0) / sites.length;
    const lat = sites.reduce((sum, site) => sum + site.geometry.coordinates[1], 0) / sites.length;
    const unverified = sites.every((site) => site.properties.verification === 'unverified');
    return { sites, position: [lon, lat], lead: PinGroups.#lead(sites), unverified };
  }

  static #lead(sites: readonly SiteFeature[]): ReportType {
    const count = (type: ReportType) => sites.filter((site) => site.properties.report_type === type).length;
    // reduce keeps the earlier type on a tie, since only a strictly larger count replaces it.
    return REPORT_TYPES.reduce((best, type) => (count(type) > count(best) ? type : best));
  }
}
