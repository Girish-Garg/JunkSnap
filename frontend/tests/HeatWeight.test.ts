import { describe, expect, it } from 'vitest';
import { HeatWeight } from '../src/domain/HeatWeight';
import type { SiteInsights } from '../src/domain/SiteInsights';
import { testSite } from './siteBuilder';

const SOURCE = { signal: 'vision_judge', provider: 'bedrock', model: 'test-model', version: '1' } as const;
const insights = (size: 'small' | 'large', hazard: boolean): SiteInsights => ({
  reports: 3,
  composition: [],
  size_class: { value: size, reports: 3, sources: [SOURCE] },
  hazards: hazard ? [{ hazard: 'burning', reports: 1, sources: [SOURCE] }] : [],
  near: [],
});

describe('HeatWeight', () => {
  const fresh = { verification: 'unverified', verified_count: 0, report_count: 1, backers: { count: 1, needed: 10, photo_people: 1, vote_people: 0 } } as const;

  it('gives a fresh one-report site enough weight to show, not 0.03 as before', () => {
    // Prod's only Jodhpur site on 11 Oct 2026 looked like this and drew no visible heat.
    expect(HeatWeight.of(testSite(fresh).properties)).toBeCloseTo(0.4 + 0.035 + 0.015);
  });

  it('grows with the people backing a site, and a verified site gets the full backers share', () => {
    const half = testSite({ ...fresh, backers: { ...fresh.backers, count: 5 } });
    expect(HeatWeight.of(half.properties)).toBeCloseTo(0.4 + 0.175 + 0.015);
    expect(HeatWeight.of(testSite({ verification: 'verified', report_count: 10 }).properties)).toBeCloseTo(0.9);
  });

  it('adds weight for a large site with a hazard, capped at 1', () => {
    const small = testSite({ report_count: 4, insights: insights('small', false) });
    const large = testSite({ report_count: 4, insights: insights('large', true) });
    expect(HeatWeight.of(small.properties)).toBeCloseTo(0.81);
    expect(HeatWeight.of(large.properties)).toBe(1);
  });
});
