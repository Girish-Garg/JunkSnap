import { describe, expect, it } from 'vitest';
import { BBox } from '../src/domain/BBox';
import { MockApiClient } from '../src/services/MockApiClient';
import { siteFixtureLoaders } from '../src/services/siteFixtures';

const ALL_INDIA = new BBox(60, 4, 100, 38.5);
const AROUND_JODHPUR = BBox.around([73.02, 26.27], 1);
const api = new MockApiClient(siteFixtureLoaders);

describe('MockApiClient.listSites returns the fixtures', () => {
  it('returns every site fixture in contracts/fixtures', async () => {
    const sites = await api.listSites(ALL_INDIA);
    const ids = sites.map((site) => site.properties.site_id);
    expect(Object.keys(siteFixtureLoaders).length).toBeGreaterThan(0);
    expect(sites).toHaveLength(Object.keys(siteFixtureLoaders).length);
    expect(ids).toEqual(expect.arrayContaining(['site_jdh_1', 'site_jdh_2', 'site_jdh_3']));
  });

  it('returns fixture sites as GeoJSON point features', async () => {
    for (const site of await api.listSites(ALL_INDIA)) {
      expect(site.type).toBe('Feature');
      expect(site.geometry.type).toBe('Point');
      expect(site.geometry.coordinates).toHaveLength(2);
    }
  });
});

describe('MockApiClient.listSites follows the API rules', () => {
  it('leaves out rejected sites', async () => {
    const site = await api.getSite('site_jdh_1');
    const rejected = { ...site, properties: { ...site.properties, verification: 'rejected' as const } };
    const withRejected = new MockApiClient({ ok: () => api.getSite('site_jdh_2'), rejected: async () => rejected });
    const ids = (await withRejected.listSites(ALL_INDIA)).map((found) => found.properties.site_id);
    expect(ids).toEqual(['site_jdh_2']);
  });

  it('keeps only the sites inside the bbox, newest first', async () => {
    const sites = await api.listSites(AROUND_JODHPUR);
    const lastReported = sites.map((site) => site.properties.last_reported_at);
    expect(sites.every((site) => site.properties.location.town === 'Jodhpur')).toBe(true);
    expect(sites.map((site) => site.properties.site_id)).not.toContain('site_jpr_1');
    expect(lastReported).toEqual([...lastReported].sort().reverse());
  });
});

describe('MockApiClient.getSite', () => {
  it('gets one site by id', async () => {
    const site = await api.getSite('site_jdh_1');
    expect(site.properties.site_id).toBe('site_jdh_1');
    expect(site.properties.report_type).toBe('waste_dump');
  });

  it('rejects an unknown id with the contract not_found error', async () => {
    await expect(api.getSite('site_missing')).rejects.toMatchObject({ status: 404, code: 'not_found' });
  });
});
