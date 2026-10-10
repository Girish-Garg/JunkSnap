import type { SiteProperties } from '../../domain/Site';
import { SiteLifecycle } from '../../domain/SiteLifecycle';

/** Why a site takes no more votes, photos or letters; the key under site.closed.* in the i18n files. */
export type ClosedReason =
  | 'removed'
  | 'photosReported'
  | 'expired'
  | 'rejected'
  | 'rejectedNoBin'
  | 'cleaned'
  | 'cleanedByVotes'
  | 'cleanedByPhoto'
  | 'binNow'
  | 'other';

// Off-map statuses with their own reason; expired is the 90-day site expiry (decision 20261010-1855).
const BY_STATUS: ReadonlyMap<string, ClosedReason> = new Map([
  ['removed', 'removed'],
  ['expired', 'expired'],
]);

/**
 * Decision 20261010-1700 and 20261010-1530: a removed, cleaned or rejected site is off the map and the
 * api refuses its votes and cleanups, so the sheet shows the status and why instead of the actions.
 */
export class SiteClosure {
  static reasonOf(site: SiteProperties): ClosedReason | null {
    if (site.verification === 'rejected') return site.report_type === 'no_bin' ? 'rejectedNoBin' : 'rejected';
    if (new SiteLifecycle(site).isActive()) return null;
    if (site.status === 'cleaned') return SiteClosure.#cleaned(site);
    // Decision 20261011-0310-hem-photo-flags: many people reported every photo of an unverified site.
    if (site.removed_reason === 'photos_reported') return 'photosReported';
    return BY_STATUS.get(site.status) ?? 'other';
  }

  // A no-bin zone is "cleared" when a bin is there now; an older row without cleaned_by says only that it was cleared.
  static #cleaned(site: SiteProperties): ClosedReason {
    if (site.report_type === 'no_bin') return 'binNow';
    if (site.cleaned_by === 'votes') return 'cleanedByVotes';
    return site.cleaned_by === 'after_photo' ? 'cleanedByPhoto' : 'cleaned';
  }
}
