import type { SiteProperties } from '../../domain/Site';

/** Why a site takes no more votes, photos or letters; the key under site.closed.* in the i18n files. */
export type ClosedReason = 'removed' | 'rejected' | 'cleanedByVotes' | 'cleanedByPhoto' | 'binNow' | 'other';

// Statuses that still take votes, cleanups and letters; every other status is off the active map.
const ACTIVE: ReadonlySet<string> = new Set(['open', 'reopened']);

/**
 * Decision 20261010-1700 and 20261010-1530: a removed, cleaned or rejected site is off the map and the
 * api refuses its votes and cleanups, so the sheet shows the status and why instead of the actions.
 */
export class SiteClosure {
  static reasonOf(site: SiteProperties): ClosedReason | null {
    if (site.verification === 'rejected') return 'rejected';
    if (ACTIVE.has(site.status)) return null;
    if (site.status === 'removed') return 'removed';
    return site.status === 'cleaned' ? SiteClosure.#cleaned(site) : 'other';
  }

  // A no-bin zone is "cleared" when a bin is there now.
  static #cleaned(site: SiteProperties): ClosedReason {
    if (site.report_type === 'no_bin') return 'binNow';
    return site.cleaned_by === 'votes' ? 'cleanedByVotes' : 'cleanedByPhoto';
  }
}
