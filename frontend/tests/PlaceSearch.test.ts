import { describe, expect, it } from 'vitest';
import { PlaceSearch } from '../src/domain/PlaceSearch';
import { testSite } from './siteBuilder';

const sites = [
  testSite({ site_id: 'site_a' }),
  testSite({ site_id: 'site_b', location: { ward: { id: 'test-mc-w12', name: 'Ward 12' } } }),
  testSite({
    site_id: 'site_c',
    location: { state: 'Assam', town: 'Guwahati', ward: null, assembly_seat: null, local_body: null },
  }),
];
const search = new PlaceSearch(sites);

describe('PlaceSearch', () => {
  it('finds a ward by name with its sites', () => {
    const [ward] = search.find('ward 37');
    expect(ward).toMatchObject({ name: 'Ward 37', kind: 'ward' });
    expect(ward?.sites.map((site) => site.properties.site_id)).toEqual(['site_a']);
  });

  it('groups every site of a seat or town', () => {
    const seat = search.find('sardarpura').find((place) => place.kind === 'assembly');
    expect(seat?.sites).toHaveLength(2);
    expect(search.find('guwahati')[0]?.kind).toBe('town');
  });

  it('skips a missing assembly seat and returns nothing for no match', () => {
    expect(search.find('  ')).toEqual([]);
    expect(search.find('mumbai')).toEqual([]);
  });
});
