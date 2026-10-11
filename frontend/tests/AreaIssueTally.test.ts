import { describe, expect, it } from 'vitest';
import { AreaIssueTally, type TalliedSite } from '../src/domain/AreaIssueTally';
import { AREA_ISSUE_GATE } from '../src/domain/SiteActionGates';

const site = (report_type: TalliedSite['report_type'], verified_count: number, rest: Partial<TalliedSite> = {}): TalliedSite => ({
  report_type,
  verified_count,
  verification: 'verified',
  status: 'open',
  ...rest,
});

const decide = (tally: AreaIssueTally, issue: Parameters<AreaIssueTally['count']>[0]) => AREA_ISSUE_GATE.decide({ count: tally.count(issue), min: tally.min });

describe('the area letter default issue', () => {
  it('defaults to the issue type with the most verified reports', () => {
    const sites = [site('contaminated_water', 4), site('waste_dump', 7), site('waste_dump', 5), site('waste_dump', 9, { status: 'removed' })];
    const tally = new AreaIssueTally({ verified_reports: 16, no_bin_reports: 0 }, 10, sites);
    expect(tally.count('waste_dump')).toEqual({ issue: 'waste_dump', seen: 12, most: 12 });
    expect(tally.pick()).toBe('waste_dump');
  });

  it('takes every issue at once when the top type may not reach 10, as the map does not show every site', () => {
    const tally = new AreaIssueTally({ verified_reports: 14, no_bin_reports: 3 }, 10, [site('waste_dump', 7), site('open_construction', 2, { verification: 'unverified' })]);
    expect(tally.count('waste_dump')).toEqual({ issue: 'waste_dump', seen: 7, most: 11 });
    expect(tally.pick()).toBe('all');
  });

  it('has nothing to pick when no issue can reach 10', () => {
    expect(new AreaIssueTally({ verified_reports: 6, no_bin_reports: 0 }, 10, [site('waste_dump', 6)]).pick()).toBeNull();
  });
});

describe('area letter issue gates', () => {
  it('turns off an issue under 10 with its count as the reason', () => {
    const tally = new AreaIssueTally({ verified_reports: 16, no_bin_reports: 6 }, 10, [site('waste_dump', 10)]);
    expect(decide(tally, 'no_bin')).toEqual({ enabled: false, reason: 'areaLetter.tooFew.no_bin', params: { n: 6, min: 10 } });
    expect(decide(tally, 'waste_dump')).toEqual({ enabled: true });
    expect(decide(tally, 'contaminated_water')).toEqual({ enabled: false, reason: 'areaLetter.tooFew.contaminated_water', params: { n: 0, min: 10 } });
  });

  it('keeps an issue on while the reports the map cannot show could still bring it to 10', () => {
    const tally = new AreaIssueTally({ verified_reports: 12, no_bin_reports: 0 }, 10, [site('waste_dump', 2)]);
    expect(decide(tally, 'overflowing_bin')).toEqual({ enabled: true });
    const short = new AreaIssueTally({ verified_reports: 12, no_bin_reports: 0 }, 10, [site('waste_dump', 5)]);
    expect(decide(short, 'overflowing_bin')).toEqual({ enabled: false, reason: 'areaLetter.tooFewHere', params: { min: 10 } });
  });
});
