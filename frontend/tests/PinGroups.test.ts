import { describe, expect, it } from 'vitest';
import type { SiteFeature } from '../src/domain/Site';
import { PinFeatures } from '../src/features/map/PinFeatures';
import { PinGroups } from '../src/features/map/PinGroups';
import { testSite } from './siteBuilder';

const SPOT: readonly [number, number] = [73.0035, 26.2618];
const UNVERIFIED = { verification: 'unverified', backers: { count: 1, needed: 10, photo_people: 1, vote_people: 0 } } as const;
// About 5 m east of SPOT, and about 220 m north of it.
const FIVE_METRES_EAST: readonly [number, number] = [73.00355, 26.2618];
const FAR_NORTH: readonly [number, number] = [73.0035, 26.2638];

const ids = (sites: readonly SiteFeature[]) => sites.map((site) => site.properties.site_id).sort();

describe('PinGroups.of', () => {
  const groups = new PinGroups();

  it('stacks seven unverified sites on one spot into one pin with all seven', () => {
    const sites = Array.from({ length: 7 }, (_, n) => testSite({ site_id: `site_${n}`, coordinates: SPOT, ...UNVERIFIED }));
    const [stack, ...rest] = groups.of(sites, 16);
    expect(rest).toHaveLength(0);
    expect(stack?.sites).toHaveLength(7);
    expect(stack).toMatchObject({ lead: 'waste_dump', unverified: true });
    expect(PinGroups.metresBetween(stack?.position ?? [0, 0], SPOT)).toBeLessThan(0.01);
  });

  it('stacks a photo site and a site of another type a few metres away at every zoom', () => {
    const dump = testSite({ site_id: 'site_dump', coordinates: SPOT });
    const water = testSite({ site_id: 'site_water', report_type: 'contaminated_water', coordinates: FIVE_METRES_EAST });
    for (const zoom of [12, 16, 22]) {
      const result = groups.of([dump, water], zoom);
      expect(result).toHaveLength(1);
      expect(ids(result[0]?.sites ?? [])).toEqual(['site_dump', 'site_water']);
    }
  });

  it('stacks pins that overlap on screen when zoomed out and splits them when zoomed in', () => {
    const near = testSite({ site_id: 'site_a', coordinates: SPOT });
    const far = testSite({ site_id: 'site_b', coordinates: FAR_NORTH });
    expect(groups.of([near, far], 12)).toHaveLength(1);
    expect(groups.of([near, far], 16)).toHaveLength(2);
  });

});

describe('PinGroups.of counts and looks', () => {
  const groups = new PinGroups();

  it('never drops or repeats a site', () => {
    const sites = Array.from({ length: 40 }, (_, n) =>
      testSite({ site_id: `site_${String(n).padStart(2, '0')}`, coordinates: [73 + (n % 8) * 0.0004, 26.26 + Math.floor(n / 8) * 0.0004] }),
    );
    for (const zoom of [10, 14, 18]) {
      const all = groups.of(sites, zoom).flatMap((group) => group.sites);
      expect(ids(all)).toEqual(ids(sites));
    }
  });

  it('leads with the most common type, ties going to the earlier type in the legend', () => {
    const water = testSite({ site_id: 'site_1', report_type: 'contaminated_water', coordinates: SPOT });
    const bin = testSite({ site_id: 'site_2', report_type: 'overflowing_bin', coordinates: SPOT });
    expect(groups.of([bin, water], 14)[0]?.lead).toBe('contaminated_water');
    const bin2 = testSite({ site_id: 'site_3', report_type: 'overflowing_bin', coordinates: SPOT });
    expect(groups.of([bin, water, bin2], 14)[0]?.lead).toBe('overflowing_bin');
  });

  it('draws a stack solid once any site in it is verified', () => {
    const verified = testSite({ site_id: 'site_v', coordinates: SPOT });
    const waiting = testSite({ site_id: 'site_u', coordinates: SPOT, ...UNVERIFIED });
    expect(groups.of([verified, waiting], 14)[0]?.unverified).toBe(false);
  });
});

describe('PinGroups distances', () => {
  it('measures ground metres and screen pixels at a zoom', () => {
    expect(PinGroups.metresBetween(SPOT, FIVE_METRES_EAST)).toBeCloseTo(5, 0);
    expect(PinGroups.metresBetween(SPOT, FAR_NORTH)).toBeCloseTo(221, 0);
    // Each zoom step doubles the distance on screen.
    const at14 = PinGroups.pixelsBetween(SPOT, FAR_NORTH, 14);
    expect(PinGroups.pixelsBetween(SPOT, FAR_NORTH, 15)).toBeCloseTo(at14 * 2, 6);
  });
});

describe('PinFeatures', () => {
  const dump = testSite({ site_id: 'site_dump', coordinates: SPOT, ...UNVERIFIED });
  const water = testSite({ site_id: 'site_water', report_type: 'contaminated_water', coordinates: SPOT, ...UNVERIFIED });
  const lone = testSite({ site_id: 'site_lone', coordinates: FAR_NORTH, ...UNVERIFIED });

  it('draws a lone site as itself with its n/10 badge and a stack as one point with a count and no badge', () => {
    const features = PinFeatures.pins(new PinGroups().of([dump, water, lone], 16)).features;
    expect(features).toHaveLength(2);
    const stack = features.find((feature) => feature.properties?.['stack_count'] !== undefined);
    expect(stack?.properties).toEqual({
      stack_ids: 'site_dump,site_water',
      stack_count: 2,
      stack_icon: 'pin-stack-unverified-waste_dump',
    });
    const single = features.find((feature) => feature.properties?.['site_id'] === 'site_lone');
    expect(single?.properties).toMatchObject({ backers_badge: '1/10' });
  });

  it('keeps every site, flat, in the source for heat, zones and the selected pin', () => {
    expect(PinFeatures.sites([dump, water]).features.map((feature) => feature.properties?.['site_id'])).toEqual(['site_dump', 'site_water']);
  });

  it('reads a tap on a stack or a site back from the rendered feature', () => {
    expect(PinFeatures.hit({ stack_ids: 'site_a,site_b', stack_count: 2 })).toEqual({ kind: 'stack', siteIds: ['site_a', 'site_b'] });
    expect(PinFeatures.hit({ site_id: 'site_a' })).toEqual({ kind: 'site', siteId: 'site_a' });
    expect(PinFeatures.hit(undefined)).toBeNull();
  });
});
