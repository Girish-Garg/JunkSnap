import type { ReportType } from './ReportType';
import type { LatLon, ReportDraft } from './ReportUpload';
import type { LonLat, SiteContext, SiteFeature } from './Site';
import { HIGH_CAP_M } from './TargetPlacement';
import { metresBetween } from './utils';

/** The api merges a report into a site within this distance of its point (backend NoBinZone, SITE_MERGE_RADIUS_M). */
export const SITE_MERGE_RADIUS_M = 40;
/** Farther than the merge radius, the photo is marked long range on the site's point, up to the long-range cap. */
export const LONG_RANGE_CAP_M = HIGH_CAP_M;

/** Where a photo for the site stands: close enough as it is, marked on the site from afar, or too far. */
export type PhotoReach =
  | { readonly kind: 'here'; readonly metres: number }
  | { readonly kind: 'longRange'; readonly metres: number; readonly target: LatLon }
  | { readonly kind: 'tooFar'; readonly metres: number; readonly limit: number };

export type SitePhotoChoice = Pick<ReportDraft, 'report_type' | 'context' | 'note' | 'target' | 'me_too_site_id'>;

/**
 * "Add a photo" on a site: Snap opens preset to the site's type and context and sends me_too_site_id, so the
 * api ranks the merge toward this site (it still checks distance and the image embedding). A no-bin zone is
 * where the reporter stands, so its photos never take a long-range target.
 */
export class SitePhotoPreset {
  readonly siteId: string;
  readonly reportType: ReportType;
  readonly context: SiteContext;
  readonly point: LonLat;

  private constructor(siteId: string, reportType: ReportType, context: SiteContext, point: LonLat) {
    this.siteId = siteId;
    this.reportType = reportType;
    this.context = context;
    this.point = point;
  }

  static of(site: SiteFeature): SitePhotoPreset {
    const { site_id: siteId, report_type: type, context } = site.properties;
    return new SitePhotoPreset(siteId, type, context, site.geometry.coordinates);
  }

  /** The farthest a photo can be taken from the site and still be sent to it. */
  get limitM(): number {
    return this.reportType === 'no_bin' ? SITE_MERGE_RADIUS_M : LONG_RANGE_CAP_M;
  }

  reach(gps: LatLon): PhotoReach {
    const metres = metresBetween([gps.lon, gps.lat], this.point);
    if (metres <= SITE_MERGE_RADIUS_M) return { kind: 'here', metres };
    if (metres > this.limitM) return { kind: 'tooFar', metres, limit: this.limitM };
    const [lon, lat] = this.point;
    return { kind: 'longRange', metres, target: { lat, lon } };
  }

  /** The report choice for a photo taken at gps; null when it is too far to join the site. */
  choice(gps: LatLon, note: string): SitePhotoChoice | null {
    const reach = this.reach(gps);
    if (reach.kind === 'tooFar') return null;
    const trimmed = note.trim();
    return {
      report_type: this.reportType,
      context: this.context,
      me_too_site_id: this.siteId,
      ...(reach.kind === 'longRange' ? { target: reach.target } : {}),
      ...(trimmed ? { note: trimmed } : {}),
    };
  }
}
