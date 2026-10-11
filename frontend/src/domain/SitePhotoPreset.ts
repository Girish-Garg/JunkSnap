import type { ReportType } from './ReportType';
import type { LatLon, ReportDraft } from './ReportUpload';
import type { LonLat, SiteContext, SiteFeature } from './Site';
import type { TargetReach } from './TargetPlacement';
import { metresBetween } from './utils';

/**
 * The config's SiteRules a photo for a site needs: the api merges a report into a site within siteMergeRadiusM of
 * its point (backend SITE_MERGE_RADIUS_M), and refuses a target farther than targetMaxM from gps (422
 * target_too_far), so an up-high photo keeps targetMarginM clear of that edge. From the ground the reach is
 * targetGroundMaxM (decision 20261011-0400).
 */
export interface SitePhotoRules extends Omit<TargetReach, 'targetHereM'> {
  readonly siteMergeRadiusM: number;
  readonly targetMarginM: number;
}

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
  readonly #rules: SitePhotoRules;

  private constructor(site: SiteFeature, rules: SitePhotoRules) {
    this.siteId = site.properties.site_id;
    this.reportType = site.properties.report_type;
    this.context = site.properties.context;
    this.point = site.geometry.coordinates;
    this.#rules = rules;
  }

  static of(site: SiteFeature, rules: SitePhotoRules): SitePhotoPreset {
    return new SitePhotoPreset(site, rules);
  }

  /** A no-bin zone has no long range, so "I'm up high" means nothing there. */
  get takesTarget(): boolean {
    return this.reportType !== 'no_bin';
  }

  /** The farthest a photo can be taken from the site and still be sent to it; up high reaches farther. */
  limitM(high = false): number {
    const { siteMergeRadiusM, targetGroundMaxM, targetMaxM, targetMarginM } = this.#rules;
    if (!this.takesTarget) return siteMergeRadiusM;
    return high ? targetMaxM - targetMarginM : targetGroundMaxM;
  }

  reach(gps: LatLon, high = false): PhotoReach {
    const metres = metresBetween([gps.lon, gps.lat], this.point);
    if (metres <= this.#rules.siteMergeRadiusM) return { kind: 'here', metres };
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
