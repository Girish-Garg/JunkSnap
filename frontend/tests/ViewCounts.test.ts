import { describe, expect, it } from 'vitest';
import { BBox } from '../src/domain/BBox';
import { SiteFilter } from '../src/domain/SiteFilter';
import { ViewCounts } from '../src/domain/ViewCounts';
import { testSite } from './siteBuilder';

const IN_VIEW: [number, number] = [73.02, 26.27];
const OUT_OF_VIEW: [number, number] = [75.8, 26.85];
const VIEW = new BBox(72.9, 26.1, 73.2, 26.4);

const sites = [
  testSite({ site_id: 'a', report_type: 'waste_dump', verification: 'verified', coordinates: IN_VIEW }),
  testSite({ site_id: 'b', report_type: 'waste_dump', verification: 'unverified', coordinates: IN_VIEW }),
  testSite({ site_id: 'c', report_type: 'no_bin', verification: 'unverified', coordinates: IN_VIEW }),
  // Loaded by a neighbouring tile but outside the visible view.
  testSite({ site_id: 'd', report_type: 'waste_dump', verification: 'verified', coordinates: OUT_OF_VIEW }),
  testSite({ site_id: 'e', report_type: 'waste_dump', verification: 'rejected', coordinates: IN_VIEW }),
];

describe('ViewCounts.of', () => {
  it('counts only sites inside the view, never rejected ones', () => {
    const counts = ViewCounts.of(sites, VIEW, new SiteFilter());
    expect(counts.types).toEqual({ waste_dump: 2, no_bin: 1, contaminated_water: 0, open_construction: 0, overflowing_bin: 0 });
    expect(counts.states).toEqual({ verified: 1, unverified: 2 });
  });

  it('counts a type by the states still switched on, and a state by the types still switched on', () => {
    const verifiedOnly = ViewCounts.of(sites, VIEW, new SiteFilter().toggleState('unverified'));
    expect(verifiedOnly.types.waste_dump).toBe(1);
    expect(verifiedOnly.types.no_bin).toBe(0);
    const noDumps = ViewCounts.of(sites, VIEW, new SiteFilter().toggleType('waste_dump'));
    expect(noDumps.states).toEqual({ verified: 0, unverified: 1 });
  });

  it('changes with the view, so moving the map recounts', () => {
    const elsewhere = ViewCounts.of(sites, new BBox(75.5, 26.5, 76, 27), new SiteFilter());
    expect(elsewhere.types.waste_dump).toBe(1);
    expect(elsewhere.states).toEqual({ verified: 1, unverified: 0 });
  });

  it('leaves out expired, cleaned and removed sites, which are off the map', () => {
    const off = (['expired', 'cleaned', 'removed'] as const).map((status, n) =>
      testSite({ site_id: `off_${n}`, report_type: 'waste_dump', verification: 'verified', status, coordinates: IN_VIEW }),
    );
    const counts = ViewCounts.of([...sites, ...off], VIEW, new SiteFilter());
    expect(counts.types.waste_dump).toBe(2);
    expect(counts.states).toEqual({ verified: 1, unverified: 2 });
  });
});
