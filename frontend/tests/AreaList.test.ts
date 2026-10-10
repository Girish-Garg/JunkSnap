import { describe, expect, it, vi } from 'vitest';
import listSchema from '../../contracts/schemas/area_list.schema.json';
import type { AreaListing } from '../src/domain/AreaListing';
import { AreaRanking } from '../src/domain/AreaRanking';
import type { AreaScores } from '../src/domain/AreaScores';
import { areaFixtureLoaders } from '../src/services/areaFixtures';
import { BoundaryCatalog } from '../src/services/BoundaryCatalog';
import { crawlFixtureLoaders } from '../src/services/crawlFixtures';
import { HttpAreaApi } from '../src/services/HttpAreaApi';
import { MockAreaApi } from '../src/services/MockAreaApi';
import { siteFixtureLoaders } from '../src/services/siteFixtures';

const mock = () => new MockAreaApi(areaFixtureLoaders, siteFixtureLoaders, crawlFixtureLoaders);

describe('MockAreaApi.list', () => {
  it('lists the seats of Jodhpur district worst first, scored before withheld', async () => {
    const listing = await mock().list('assembly', 'rajasthan-jodhpur', 50);
    expect(listing).toMatchObject({ kind: 'assembly', within: 'rajasthan-jodhpur', limit: 50 });
    expect(listing.areas[0]?.area.id).toBe('s20-ac-128');
    expect(listing.areas.length).toBe(listing.total);
    expect(listing.areas.every((row) => row.area.kind === 'assembly')).toBe(true);
    expect(listing.areas.map((row) => row.area.id)).not.toContain('s20-ac-54');
  });

  it('accepts a local body id as well as a district id', async () => {
    const byBody = await mock().list('assembly', 'jodhpur-mc', 50);
    expect(byBody.areas.map((row) => row.area.id)).toContain('s20-ac-128');
  });

  it('applies the limit but reports the total', async () => {
    const listing = await mock().list('assembly', 'rajasthan-jodhpur', 1);
    expect(listing.areas).toHaveLength(1);
    expect(listing.total).toBeGreaterThan(1);
  });

  it('returns an empty list where no site is', async () => {
    expect(await mock().list('ward', 'rajasthan-jaisalmer', 50)).toMatchObject({ total: 0, areas: [] });
  });
});

describe('area_list fixture (contracts/fixtures/area_list.jdh-1.json)', () => {
  const fixtures = import.meta.glob<AreaListing>('../../contracts/fixtures/area_list.*.json', { eager: true, import: 'default' });
  const listings = Object.values(fixtures);

  it('has the keys area_list.schema.json requires', () => {
    expect(listings.length).toBeGreaterThan(0);
    for (const listing of listings) expect(Object.keys(listing)).toEqual(expect.arrayContaining([...listSchema.required]));
  });

  it('comes in the order the mock and the ranking use, and ranks only shown scores', () => {
    for (const listing of listings) {
      expect([...listing.areas].sort(AreaRanking.compare)).toEqual(listing.areas);
      const ranks = AreaRanking.of(listing.areas).map(({ rank, standing }) => [rank, standing.id]);
      expect(ranks).toEqual([
        [1, 's20-ac-128'],
        [null, 's20-ac-127'],
      ]);
    }
  });

  it('is what the mock returns for Jodhpur assembly seats', async () => {
    const listing = await mock().list('assembly', 'rajasthan-jodhpur', 50);
    // Same areas, order, scores and counts; the ward_scores fixture wins on metrics (the two fixtures drift there).
    const summary = (rows: readonly AreaScores[] = []) =>
      rows.map(({ area, scores, counts }) => ({ id: area.id, scores, reports: counts.verified_reports }));
    expect(summary(listing.areas.slice(0, 2))).toEqual(summary(listings[0]?.areas));
  });
});

describe('HttpAreaApi.list', () => {
  it('asks GET /areas/{kind}?within&limit and returns the body as is', async () => {
    const body = { kind: 'loksabha', within: 'rajasthan-jodhpur', total: 0, limit: 20, areas: [] };
    const fetchImpl = vi.fn(async () => Response.json(body));
    const listing = await new HttpAreaApi('https://api.example.test/', fetchImpl).list('loksabha', 'rajasthan-jodhpur', 20);
    expect(fetchImpl).toHaveBeenCalledWith('https://api.example.test/areas/loksabha?within=rajasthan-jodhpur&limit=20', expect.anything());
    expect(listing).toEqual(body);
  });
});

describe('BoundaryCatalog', () => {
  const index = (layers: object) => async () => Response.json({ layers });

  it('reads the areas layer from the index: present, fine edges and credit', async () => {
    const layers = { areas: { fine: { bytes: 1 }, attribution: 'Seats' }, wards: {} };
    expect(await new BoundaryCatalog('/b', index(layers)).index()).toEqual({
      available: true,
      fine: true,
      attribution: 'Seats',
    });
    expect(await new BoundaryCatalog('/b', index({ areas: {} })).index()).toEqual({
      available: true,
      fine: false,
      attribution: null,
    });
  });

  it('draws nothing without an areas layer or a readable index', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const none = { available: false, fine: false, attribution: null };
    expect(await new BoundaryCatalog('/b', index({ assembly: {}, wards: {} })).index()).toEqual(none);
    expect(await new BoundaryCatalog('/b', async () => new Response('', { status: 404 })).index()).toEqual(none);
    expect(await new BoundaryCatalog('/b', () => Promise.reject(new Error('offline'))).index()).toEqual(none);
  });
});

describe('BoundaryCatalog files', () => {
  it('names the areas files', () => {
    const catalog = new BoundaryCatalog('https://app.example.test/boundaries');
    expect(catalog.polygonsUrl()).toBe('https://app.example.test/boundaries/areas.geojson');
    expect(catalog.fineUrl()).toBe('https://app.example.test/boundaries/areas_fine.geojson');
    expect(catalog.labelsUrl()).toBe('https://app.example.test/boundaries/areas_labels.geojson');
  });

  it('loads the marker points, and fails loudly when they are missing', async () => {
    const points = { type: 'FeatureCollection', features: [] };
    const calls: string[] = [];
    const ok = new BoundaryCatalog('/b/', async (input) => {
      calls.push(String(input));
      return Response.json(points);
    });
    expect(await ok.labels()).toEqual(points);
    expect(calls).toEqual(['/b/areas_labels.geojson']);
    const missing = new BoundaryCatalog('/b/', async () => new Response('', { status: 404 }));
    await expect(missing.labels()).rejects.toThrow('404');
  });
});
