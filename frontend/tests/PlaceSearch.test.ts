import { describe, expect, it } from 'vitest';
import { BBox } from '../src/domain/BBox';
import { PlaceSearch } from '../src/domain/PlaceSearch';
import { MockApiClient } from '../src/services/MockApiClient';
import { siteFixtureLoaders } from '../src/services/siteFixtures';

const sites = await new MockApiClient(siteFixtureLoaders).listSites(new BBox(60, 4, 100, 38.5));
const search = new PlaceSearch(sites);

describe('PlaceSearch', () => {
  it('finds a ward by name with its sites', () => {
    const [ward] = search.find('ward 37');
    expect(ward).toMatchObject({ name: 'Ward 37', kind: 'ward' });
    expect(ward?.sites.map((site) => site.properties.site_id)).toEqual(['site_jdh_1']);
  });

  it('groups every site of a seat or town', () => {
    const town = search.find('jodhpur').find((place) => place.kind === 'town');
    expect(town?.sites).toHaveLength(3);
    expect(search.find('sardarpura')[0]?.kind).toBe('assembly');
  });

  it('returns nothing for a blank query or no match', () => {
    expect(search.find('  ')).toEqual([]);
    expect(search.find('mumbai')).toEqual([]);
  });
});
