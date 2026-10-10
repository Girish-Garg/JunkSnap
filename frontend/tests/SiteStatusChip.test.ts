import { describe, expect, it } from 'vitest';
import type { SiteBackers } from '../src/domain/Site';
import { SiteStatusChip } from '../src/domain/SiteStatusChip';
import { SwipeDismiss } from '../src/ui/SwipeDismiss';

const BACKERS: SiteBackers = { count: 1, needed: 10, photo_people: 1, vote_people: 0 };
const chip = (status: string, verification: string, backers: SiteBackers | null = BACKERS) =>
  SiteStatusChip.of({ status, verification, ...(backers ? { backers } : {}) } as Parameters<typeof SiteStatusChip.of>[0]);

describe('SiteStatusChip', () => {
  it('says waiting with the backers on an open unverified site, never a red Open', () => {
    expect(chip('open', 'unverified')).toEqual({ key: 'chip.waiting', params: { count: 1, needed: 10 }, tone: 'waiting' });
    expect(chip('open', 'unverified', { ...BACKERS, count: 14 }).params).toEqual({ count: 10, needed: 10 });
  });

  it('says verified, cleared, reopened, or why a site is closed', () => {
    expect(chip('open', 'verified')).toMatchObject({ key: 'chip.verified', tone: 'verified' });
    expect(chip('cleaned', 'verified')).toMatchObject({ key: 'chip.cleared', tone: 'cleared' });
    expect(chip('reopened', 'verified')).toMatchObject({ key: 'chip.reopened', tone: 'reopened' });
    expect(chip('expired', 'unverified')).toMatchObject({ key: 'chip.expired', tone: 'closed' });
    expect(chip('open', 'rejected')).toMatchObject({ key: 'chip.rejected', tone: 'closed' });
  });

  it('says cleared with the count while people confirm a clearing, on an active site only', () => {
    const clearance = { count: 1, needed: 3, still_there: 0 };
    const of = (status: string) => SiteStatusChip.of({ status, verification: 'verified', backers: BACKERS, clearance } as Parameters<typeof SiteStatusChip.of>[0]);
    expect(of('open')).toEqual({ key: 'chip.clearing', params: { count: 1, needed: 3 }, tone: 'cleared' });
    expect(of('reopened')).toMatchObject({ key: 'chip.clearing' });
    expect(of('cleaned')).toMatchObject({ key: 'chip.cleared' });
  });

  it('has no numbers, never NaN, for an older row without backers', () => {
    expect(chip('open', 'unverified', null)).toEqual({ key: 'chip.waitingPlain', tone: 'waiting' });
  });
});

describe('SwipeDismiss', () => {
  it('follows the finger down only, and a short slow pull springs back', () => {
    let state = SwipeDismiss.begin(500, 0);
    state = SwipeDismiss.move(state, 496, 100);
    expect(SwipeDismiss.offset(state)).toBe(0);
    state = SwipeDismiss.move(state, 530, 400);
    expect(SwipeDismiss.offset(state)).toBe(30);
    expect(SwipeDismiss.dismisses(state)).toBe(false);
  });

  it('dismisses a long pull or a quick throw, and never a tap', () => {
    const far = SwipeDismiss.move(SwipeDismiss.begin(500, 0), 580, 1000);
    expect(SwipeDismiss.dismisses(far)).toBe(true);
    const quick = SwipeDismiss.move(SwipeDismiss.begin(500, 0), 530, 30);
    expect(SwipeDismiss.dismisses(quick)).toBe(true);
    const tap = SwipeDismiss.move(SwipeDismiss.begin(500, 0), 503, 30);
    expect(SwipeDismiss.dismisses(tap)).toBe(false);
  });
});
