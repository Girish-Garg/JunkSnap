import type { SiteProperties } from './Site';
import { SiteLifecycle } from './SiteLifecycle';

/**
 * A list row's one status chip: people saying it is cleared (waiting for enough of them), verified, or still
 * waiting for 10 people to back it (decisions 20261010-1530 and -1855).
 */
export interface SiteChipView {
  readonly kind: 'cleared' | 'verified' | 'waiting';
  /** People so far, for "Waiting · 3 of 10" and "Cleared · 1 of 3"; null for verified. */
  readonly count: number | null;
  readonly needed: number | null;
}

type ChipFields = Pick<SiteProperties, 'verification' | 'backers' | 'status' | 'clearance' | 'expires_at'>;

export class SiteChip {
  static of(site: ChipFields): SiteChipView {
    const clearance = new SiteLifecycle(site).pendingClearance();
    if (clearance) return { kind: 'cleared', count: clearance.count, needed: clearance.needed };
    if (site.verification === 'verified') return { kind: 'verified', count: null, needed: null };
    const { count, needed } = site.backers;
    return { kind: 'waiting', count: Math.min(count, needed), needed };
  }
}
