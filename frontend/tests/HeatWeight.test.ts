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
  it('weighs verified and total reports when there are no insights', () => {
    expect(HeatWeight.of(testSite({ verified_count: 0, report_count: 1 }).properties)).toBeCloseTo(0.03);
    expect(HeatWeight.of(testSite({ verified_count: 5, report_count: 10 }).properties)).toBeCloseTo(0.7);
  });

  it('adds weight for a large site with a hazard, capped at 1', () => {
    const small = testSite({ verified_count: 5, report_count: 10, insights: insights('small', false) });
    const large = testSite({ verified_count: 5, report_count: 10, insights: insights('large', true) });
    expect(HeatWeight.of(small.properties)).toBeCloseTo(0.7);
    expect(HeatWeight.of(large.properties)).toBeCloseTo(1);
  });
});
