import type { ReportType } from './ReportType';
import type { LatLon, ReportDraft } from './ReportUpload';
import type { LonLat, SiteContext, SiteFeature } from './Site';
import { GROUND_CAP_M, HIGH_CAP_M } from './TargetPlacement';
import { metresBetween } from './utils';

/** The api merges a report into a site within this distance of its point (backend NoBinZone, SITE_MERGE_RADIUS_M). */
export const SITE_MERGE_RADIUS_M = 40;
/** The api refuses a target farther than HIGH_CAP_M from gps (422 target_too_far); this keeps a photo clear of that edge. */
export const SERVER_CAP_MARGIN_M = 10;
/** Decision 20261011-0400: 300 m from the ground; up high (rooftop or upper floor), up to the server cap less the margin. */
export const GROUND_LIMIT_M = GROUND_CAP_M;
export const HIGH_LIMIT_M = HIGH_CAP_M - SERVER_CAP_MARGIN_M;

/** Where a photo for the site stands: close enough as it is, marked on the site from afar, or too far. */
export type PhotoReach =
  | { readonly kind: 'here'; readonly metres: number }
  | { readonly kind: 'longRange'; readonly metres: number; readonly target: LatLon }
  | { readonly kind: 'tooFar'; readonly metres: number; readonly limit: number };

export type SitePhotoChoice = Pick<ReportDraft, 'report_type' | 'context' | 'note' | 'target' | 'me_too_site_id'>;

/**
 * "Add a photo" on a site: Snap opens preset to the site's type and context and sends me_too_site_id, so the
 * api ranks the merge toward this site (it still checks distance and the image embedding). Farther than the merge
 * radius the photo is marked on the site's point as a long-range target. A no-bin zone is where the reporter
 * stands, so its photos never take a target.
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

  /** A no-bin zone has no long range, so "I'm up high" means nothing there. */
  get takesTarget(): boolean {
    return this.reportType !== 'no_bin';
  }

  /** The farthest a photo can be taken from the site and still be sent to it; up high reaches farther. */
  limitM(high = false): number {
    if (!this.takesTarget) return SITE_MERGE_RADIUS_M;
    return high ? HIGH_LIMIT_M : GROUND_LIMIT_M;
  }

  reach(gps: LatLon, high = false): PhotoReach {
    const metres = metresBetween([gps.lon, gps.lat], this.point);
    if (metres <= SITE_MERGE_RADIUS_M) return { kind: 'here', metres };
    const limit = this.limitM(high);
    if (metres > limit) return { kind: 'tooFar', metres, limit };
    const [lon, lat] = this.point;
    return { kind: 'longRange', metres, target: { lat, lon } };
  }

  /** The report choice for a photo taken at gps; null when it is too far to join the site. */
  choice(gps: LatLon, note: string, high = false): SitePhotoChoice | null {
    const reach = this.reach(gps, high);
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
