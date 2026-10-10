import { describe, expect, it } from 'vitest';
import { AreaDirectory } from '../src/domain/AreaDirectory';
import type { AreaListing } from '../src/domain/AreaListing';
import { BBox } from '../src/domain/BBox';
import { NearestSites } from '../src/domain/NearestSites';
import { LegendKeys } from '../src/features/map/LegendKeys';
import type { AreaMarker } from '../src/features/map/AreaMarkers';
import { areaRow } from './areaRows';
import { testSite } from './siteBuilder';

// The live bug: a phone's opening view of Jodhpur, with the only site about 700 m east of its edge.
const PHONE_VIEW = new BBox(72.995, 26.235, 73.045, 26.305);
const JUST_OFF = testSite({ site_id: 'site_near', coordinates: [73.052, 26.27] });
const FAR = testSite({ site_id: 'site_far', coordinates: [73.4, 26.6] });
const CLEARED = testSite({ site_id: 'site_cleared', status: 'cleaned', coordinates: [73.046, 26.27] });

describe('NearestSites', () => {
  it('searches one query-sized box around an empty view, and nothing around a view already that wide', () => {
    const reach = NearestSites.reach(PHONE_VIEW);
    expect(reach?.contains([73.052, 26.27])).toBe(true);
    expect(reach?.isWiderThan(1)).toBe(false);
    expect(NearestSites.reach(BBox.around([73, 26], 2))).toBeNull();
    // List mode already loads one query-sized box; searching it again would find nothing new.
    expect(NearestSites.reach(BBox.around([73.02, 26.27], 0.99))).toBeNull();
  });

  it('picks the nearest site on the active map, with others only when nearly as near', () => {
    expect(NearestSites.of([FAR, CLEARED, JUST_OFF], PHONE_VIEW.center()).map((s) => s.properties.site_id)).toEqual(['site_near']);
    const twin = testSite({ site_id: 'site_twin', coordinates: [73.055, 26.28] });
    expect(NearestSites.of([FAR, twin, JUST_OFF], PHONE_VIEW.center())).toHaveLength(2);
    expect(NearestSites.of([], PHONE_VIEW.center())).toEqual([]);
  });

  it('frames the middle of the view plus the sites, so the city stays in sight', () => {
    const [middle, site] = NearestSites.frame(PHONE_VIEW, [JUST_OFF]);
    expect(middle?.[0]).toBeCloseTo(73.02);
    expect(middle?.[1]).toBeCloseTo(26.27);
    expect(site).toEqual([73.052, 26.27]);
  });
});

const listing = (kind: AreaListing['kind'], rows: AreaListing['areas']): AreaListing => ({ kind, within: 'rajasthan-jodhpur', total: rows.length, limit: 200, areas: rows });

describe('AreaDirectory', () => {
  it('lists the pilot city first, then the districts of the sites around the map, at most three', () => {
    const jaipur = testSite({ location: { district: { id: 'rajasthan-jaipur', name: 'Jaipur' } } });
    expect(AreaDirectory.districts('rajasthan-jodhpur', [])).toEqual(['rajasthan-jodhpur']);
    expect(AreaDirectory.districts('rajasthan-jodhpur', [jaipur, JUST_OFF])).toEqual(['rajasthan-jodhpur', 'rajasthan-jaipur']);
    const ajmer = testSite({ location: { district: { id: 'rajasthan-ajmer', name: 'Ajmer' } } });
    const sorted = ['rajasthan-jodhpur', 'rajasthan-ajmer', 'rajasthan-jaipur'];
    expect(AreaDirectory.districts('rajasthan-jodhpur', [jaipur, ajmer, JUST_OFF])).toEqual(sorted);
    expect(AreaDirectory.districts('rajasthan-jodhpur', [ajmer, JUST_OFF, jaipur])).toEqual(sorted);
  });

  it('turns area list rows into one entry per area with its counts, smallest kind first, and filters by name', () => {
    const seat = areaRow({ id: 's20-ac-127', name: 'Sardarpura', reports: 4 });
    const entries = AreaDirectory.of([listing('assembly', [seat]), listing('assembly', [seat])]);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.row?.counts).toMatchObject({ sites: 1, verified_reports: 4 });
    expect(entries[0]?.area.key).toBe('assembly/s20-ac-127');
    expect(AreaDirectory.match(entries, ' sard')).toHaveLength(1);
    expect(AreaDirectory.match(entries, 'mandore')).toHaveLength(0);
  });
});

describe('LegendKeys', () => {
  const marker = (basis: AreaMarker['basis']): AreaMarker => ({ value: '1', basis, count: null, pilot: false, tooltip: '', rank: 0 });

  it('names only the area entries the map shows', () => {
    expect(LegendKeys.of(true, new Map())).toEqual({ boundaries: true, counts: false, scores: false });
    expect(LegendKeys.of(true, new Map([['a', marker('count')]]))).toEqual({ boundaries: true, counts: true, scores: false });
    expect(LegendKeys.of(true, new Map([['a', marker('score')]])).scores).toBe(true);
    expect(LegendKeys.of(false, new Map([['a', marker('score')]]))).toEqual({ boundaries: false, counts: false, scores: false });
  });
});
