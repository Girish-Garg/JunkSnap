import type { SiteProperties } from './Site';

/**
 * waiting: on the map, still gathering its 10 people. verified: on the map and verified. cleared: cleaned.
 * reopened: back after a cleanup. closed: off the map (withdrawn, expired, rejected). None of them is red:
 * a normal state never reads as an error.
 */
export type ChipTone = 'waiting' | 'verified' | 'cleared' | 'reopened' | 'closed';

export interface ChipView {
  /** i18n key under chip.* */
  readonly key: string;
  readonly params?: Readonly<Record<string, number>>;
  readonly tone: ChipTone;
}

type ChipFields = Pick<SiteProperties, 'status' | 'verification' | 'backers'>;

const BY_STATUS: Readonly<Record<string, ChipView>> = {
  cleaned: { key: 'chip.cleared', tone: 'cleared' },
  reopened: { key: 'chip.reopened', tone: 'reopened' },
  removed: { key: 'chip.removed', tone: 'closed' },
  expired: { key: 'chip.expired', tone: 'closed' },
};

/** The one status chip of a site, on the pin card, the site sheet and the lists: "Waiting · 1 of 10", "Verified", "Cleared". */
export class SiteStatusChip {
  static of(site: ChipFields): ChipView {
    const byStatus = BY_STATUS[site.status];
    if (byStatus) return byStatus;
    if (site.verification === 'rejected') return { key: 'chip.rejected', tone: 'closed' };
    if (site.verification === 'verified') return { key: 'chip.verified', tone: 'verified' };
    return SiteStatusChip.#waiting(site.backers);
  }

  // An older row without backers still says it is waiting, without numbers it does not have.
  static #waiting(backers: ChipFields['backers'] | undefined): ChipView {
    const count = Number(backers?.count);
    const needed = Number(backers?.needed);
    if (!Number.isFinite(count) || !Number.isFinite(needed) || needed <= 0) return { key: 'chip.waitingPlain', tone: 'waiting' };
    return { key: 'chip.waiting', params: { count: Math.min(count, needed), needed }, tone: 'waiting' };
  }
}
